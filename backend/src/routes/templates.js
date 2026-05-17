const express = require('express');
const RecurringTemplateModel = require('../models/recurringTemplate');
const { runLazyGeneration } = require('../services/lazyGeneration');

const router = express.Router();

// GET /api/templates
router.get('/', (req, res) => {
  const templates = RecurringTemplateModel.getByUser();
  res.json(templates);
});

// GET /api/templates/:id
router.get('/:id', (req, res) => {
  const template = RecurringTemplateModel.getById(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

// POST /api/templates
router.post('/', (req, res) => {
  const { type, recurrence = 'monthly', dayOfMonth, startDate, endDate, category, amount, description } = req.body;

  if (!category || !amount) {
    return res.status(400).json({ error: 'category and amount are required' });
  }

  const validRecurrences = ['weekly', 'biweekly', 'monthly'];
  if (!validRecurrences.includes(recurrence)) {
    return res.status(400).json({ error: 'recurrence must be weekly, biweekly, or monthly' });
  }

  if (recurrence === 'monthly') {
    if (!dayOfMonth || typeof dayOfMonth !== 'number' || dayOfMonth < 1 || dayOfMonth > 31) {
      return res.status(400).json({ error: 'dayOfMonth (1-31) is required for monthly recurrence' });
    }
  } else {
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required for weekly/biweekly recurrence' });
    }
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (endDate && startDate && endDate < startDate) {
    return res.status(400).json({ error: 'End date must be on or after start date' });
  }

  try {
    const template = RecurringTemplateModel.create({ type, recurrence, dayOfMonth, startDate, endDate, category, amount, description });
    // Immediately generate any pending transactions for the new template
    runLazyGeneration({ force: true });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', (req, res) => {
  const { type, recurrence, dayOfMonth, startDate, endDate, category, amount, description } = req.body || {};

  const existing = RecurringTemplateModel.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const hasDayOfMonth = Object.prototype.hasOwnProperty.call(req.body || {}, 'dayOfMonth');
  const hasStartDate = Object.prototype.hasOwnProperty.call(req.body || {}, 'startDate');
  const hasEndDate = Object.prototype.hasOwnProperty.call(req.body || {}, 'endDate');
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, 'description');

  const nextRecurrence = recurrence ?? existing.recurrence;
  const nextDayOfMonth = hasDayOfMonth ? dayOfMonth : existing.day_of_month;
  const nextStartDate = hasStartDate ? startDate : existing.start_date;
  const nextEndDate = hasEndDate ? endDate : existing.end_date;
  const nextAmount = amount ?? existing.amount;

  const validRecurrences = ['weekly', 'biweekly', 'monthly'];
  if (!validRecurrences.includes(nextRecurrence)) {
    return res.status(400).json({ error: 'recurrence must be weekly, biweekly, or monthly' });
  }

  if (nextRecurrence === 'monthly') {
    if (typeof nextDayOfMonth !== 'number' || nextDayOfMonth < 1 || nextDayOfMonth > 31) {
      return res.status(400).json({ error: 'dayOfMonth (1-31) is required for monthly recurrence' });
    }
  } else if (!nextStartDate) {
    return res.status(400).json({ error: 'startDate is required for weekly/biweekly recurrence' });
  }

  if (typeof nextAmount !== 'number' || nextAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (nextEndDate && nextStartDate && nextEndDate < nextStartDate) {
    return res.status(400).json({ error: 'End date must be on or after start date' });
  }

  const updated = RecurringTemplateModel.update(req.params.id, {
    type,
    recurrence,
    dayOfMonth: nextRecurrence === 'monthly' ? nextDayOfMonth : null,
    startDate: nextRecurrence === 'monthly' ? null : nextStartDate,
    endDate: hasEndDate ? (nextEndDate || null) : existing.end_date,
    category,
    amount,
    description: hasDescription ? (description || null) : existing.description,
  });

  if (!updated) {
    return res.status(500).json({ error: 'Failed to update template' });
  }

  runLazyGeneration({ force: true });
  res.json({ success: true });
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  const deleted = RecurringTemplateModel.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json({ success: true });
});

module.exports = router;
