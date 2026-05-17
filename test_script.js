const DebtModel = require('./backend/src/models/debt');
const RecurringTemplateModel = require('./backend/src/models/recurringTemplate');

async function main() {
  try {
    // 2. Find an existing debt via DebtModel.getByUser(null, { includeArchived: true })
    // Note: Model definition shows getByUser({ includeArchived: false } = {})
    const debts = DebtModel.getByUser({ includeArchived: true });
    if (!debts || debts.length === 0) {
      console.log('Error: No existing debts found.');
      process.exit(1);
    }
    const targetDebt = debts[0];
    console.log('Using debt:', targetDebt.id);

    // 3. Create a recurring template tied to that debt
    const newTemplate = RecurringTemplateModel.create({
      category: 'Debt Payment',
      type: 'Expense',
      amount: 1,
      recurrence: 'monthly',
      dayOfMonth: 1,
      description: 'Recurring debt rule test',
      debtId: targetDebt.id
    });
    console.log('Created template:', newTemplate.id);

    // 4. Update that template
    const updateSuccess = RecurringTemplateModel.update(newTemplate.id, {
      recurrence: 'weekly',
      startDate: '2026-06-01',
      dayOfMonth: null,
      debtId: targetDebt.id
    });
    if (!updateSuccess) {
      throw new Error('Failed to update template');
    }
    console.log('Updated template');

    // 5. Read the row back and print a JSON summary
    const updatedTemplate = RecurringTemplateModel.getById(newTemplate.id);
    const summary = {
      category: updatedTemplate.category,
      type: updatedTemplate.type,
      recurrence: updatedTemplate.recurrence,
      debt_id: updatedTemplate.debt_id,
      start_date: updatedTemplate.start_date
    };
    console.log('SUMMARY_START');
    console.log(JSON.stringify(summary, null, 2));
    console.log('SUMMARY_END');

    // 6. Delete the template
    const deleteSuccess = RecurringTemplateModel.delete(newTemplate.id);
    if (!deleteSuccess) {
      throw new Error('Failed to delete template');
    }
    console.log('Deleted template. Task successful.');

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();
