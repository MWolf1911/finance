/**
 * Debt Payoff Projection Service
 *
 * Calculates month-by-month payoff timelines for two strategies:
 *   - Snowball: target the lowest balance first
 *   - Avalanche: target the highest interest rate first
 *
 * Each month:
 *   1. Accrue interest on every active debt
 *   2. Pay all minimums (or remaining balance if smaller)
 *   3. Pool the extra payment + freed minimums from paid-off debts
 *   4. Apply the pool to the target debt (per strategy sort order)
 *   5. If target is paid off, roll remainder into next target
 */

const MAX_MONTHS = 600; // 50-year safety cap

/**
 * @param {Array<{id, name, current_balance, interest_rate, minimum_payment}>} debts
 * @param {number} extraMonthlyPayment - additional $ above all minimums
 * @returns {{ snowball: StrategyResult, avalanche: StrategyResult }}
 *
 * StrategyResult = {
 *   totalInterest: number,
 *   totalMonths: number,
 *   projectedPayoffDate: string,            // ISO month YYYY-MM
 *   debts: Array<{
 *     id, name, startingBalance, interestPaid, payoffMonth, payoffDate
 *   }>,
 *   timeline: Array<{ month, label, payments: [{debtId, principal, interest, balance}] }>
 * }
 */
function calculateProjection(debts, extraMonthlyPayment = 0) {
  if (!debts.length) {
    const empty = { totalInterest: 0, totalMonths: 0, projectedPayoffDate: null, debts: [], timeline: [] };
    return { snowball: empty, avalanche: empty };
  }

  const snowball = runStrategy(debts, extraMonthlyPayment, 'snowball');
  const avalanche = runStrategy(debts, extraMonthlyPayment, 'avalanche');

  return { snowball, avalanche };
}

function runStrategy(debtsInput, extraMonthlyPayment, strategy) {
  // Deep-clone so we can mutate balances
  const debts = debtsInput.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.current_balance,
    startingBalance: d.current_balance,
    monthlyRate: (d.interest_rate || 0) / 100 / 12,
    minimumPayment: d.minimum_payment || 0,
    interestPaid: 0,
    payoffMonth: null,
    payoffDate: null,
  }));

  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth(); // 0-based

  const timeline = [];
  let monthCount = 0;

  // Sum of all original minimums — used to detect freed capacity
  const totalOriginalMinimums = debts.reduce((s, d) => s + d.minimumPayment, 0);

  while (debts.some((d) => d.balance > 0) && monthCount < MAX_MONTHS) {
    monthCount++;
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }

    const monthLabel = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthPayments = [];

    // ── Step 1: Accrue interest ──
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.monthlyRate;
      d.balance += interest;
      d.interestPaid += interest;
    }

    // ── Step 2: Pay minimums ──
    let freedMins = 0;
    for (const d of debts) {
      if (d.balance <= 0) {
        // This debt is already paid off — its minimum is "freed"
        freedMins += d.minimumPayment;
        continue;
      }
      const minPay = Math.min(d.minimumPayment, d.balance);
      d.balance -= minPay;

      monthPayments.push({
        debtId: d.id,
        type: 'minimum',
        principal: minPay,
        balance: d.balance,
      });

      if (d.balance <= 0.005) {
        d.balance = 0;
        if (!d.payoffMonth) {
          d.payoffMonth = monthCount;
          d.payoffDate = monthLabel;
        }
      }
    }

    // ── Step 3: Pool extra + freed minimums ──
    let pool = extraMonthlyPayment + freedMins;

    // ── Step 4 & 5: Apply pool to target debts in strategy order ──
    const active = debts
      .filter((d) => d.balance > 0)
      .sort((a, b) => {
        if (strategy === 'snowball') return a.balance - b.balance;
        // avalanche: highest rate first
        return b.monthlyRate - a.monthlyRate;
      });

    for (const d of active) {
      if (pool <= 0) break;
      const payment = Math.min(pool, d.balance);
      d.balance -= payment;
      pool -= payment;

      monthPayments.push({
        debtId: d.id,
        type: 'extra',
        principal: payment,
        balance: d.balance,
      });

      if (d.balance <= 0.005) {
        d.balance = 0;
        if (!d.payoffMonth) {
          d.payoffMonth = monthCount;
          d.payoffDate = monthLabel;
        }
      }
    }

    timeline.push({ month: monthCount, label: monthLabel, payments: monthPayments });
  }

  const totalInterest = debts.reduce((s, d) => s + d.interestPaid, 0);
  const maxPayoffMonth = Math.max(...debts.map((d) => d.payoffMonth || 0));
  const lastDebt = debts.find((d) => d.payoffMonth === maxPayoffMonth);

  return {
    totalInterest: round2(totalInterest),
    totalMonths: maxPayoffMonth,
    projectedPayoffDate: lastDebt?.payoffDate || null,
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      startingBalance: round2(d.startingBalance),
      interestPaid: round2(d.interestPaid),
      payoffMonth: d.payoffMonth,
      payoffDate: d.payoffDate,
    })),
    timeline,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateProjection };
