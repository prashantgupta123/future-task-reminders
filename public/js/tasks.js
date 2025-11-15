document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('task-modal');
  if (!modal) return;

  const overlay = modal.querySelector('.modal-overlay');
  const closeBtn = modal.querySelector('.modal-close');

  const fields = {
    name: modal.querySelector('[data-field="name"]'),
    priority: modal.querySelector('[data-field="priority"]'),
    status: modal.querySelector('[data-field="status"]'),
    taskType: modal.querySelector('[data-field="task-type"]'),
    trigger_at: modal.querySelector('[data-field="trigger_at"]'),
    description: modal.querySelector('[data-field="description"]'),
    emails: modal.querySelector('[data-field="emails"]'),
    statusHelp: modal.querySelector('[data-field="status-help"]'),
    auditCreatedAt: modal.querySelector('[data-field="audit-created-at"]'),
    auditCreatedBy: modal.querySelector('[data-field="audit-created-by"]'),
    auditUpdatedAt: modal.querySelector('[data-field="audit-updated-at"]'),
    auditUpdatedBy: modal.querySelector('[data-field="audit-updated-by"]')
  };

  function openModal(data) {
    if (!modal) return;

    fields.name.textContent = data.name || '';
    // Priority chip styling
    fields.priority.className = 'badge';
    const code = (data.priorityCode || '').toLowerCase();
    if (code === 'high') {
      fields.priority.classList.add('badge-high');
    } else if (code === 'medium') {
      fields.priority.classList.add('badge-medium');
    } else if (code === 'low') {
      fields.priority.classList.add('badge-low');
    }
    fields.priority.textContent = data.priorityLabel || data.priorityCode || '';

    // Status chip + explanation
    fields.status.className = 'status-chip';
    const statusRaw = data.status || '';
    const isSent = statusRaw.toLowerCase() === 'sent';
    fields.status.textContent = statusRaw;
    fields.statusHelp.textContent = isSent
      ? 'Sent – reminder email has already been dispatched for this task.'
      : 'Pending – reminder email has not been sent yet. It will be sent when the trigger date and time is reached.';

    // Task type chip
    const typeCode = (data.task_type_code || data.task_type || 'public').toLowerCase();
    const typeLabel =
      data.task_type_label ||
      (typeCode === 'private' ? 'Private' : 'Public');
    fields.taskType.className = 'status-chip';
    fields.taskType.classList.add(
      typeCode === 'private' ? 'type-private' : 'type-public'
    );
    fields.taskType.textContent = typeLabel;

    fields.trigger_at.textContent = data.trigger_at || '';
    fields.description.textContent = data.description || 'No description provided.';
    fields.emails.textContent = data.emails || '';

    const createdBy = data.created_by || '-';
    const updatedBy = data.updated_by || '-';
    const updatedAt = data.updated_at || '-';
    const createdAt = data.created_at || '-';

    fields.auditCreatedAt.textContent = createdAt;
    fields.auditCreatedBy.textContent = createdBy;
    fields.auditUpdatedAt.textContent = updatedAt;
    fields.auditUpdatedBy.textContent = updatedBy;

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  document.body.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-task-view]');
    if (!btn) return;

    event.preventDefault();

    const data = {
      name: btn.dataset.name,
      priorityLabel: btn.dataset.priorityLabel,
      priorityCode: btn.dataset.priorityCode,
      status: btn.dataset.status,
      task_type_code: btn.dataset.taskTypeCode,
      task_type_label: btn.dataset.taskTypeLabel,
      trigger_at: btn.dataset.triggerAt,
      created_at: btn.dataset.createdAt,
      updated_at: btn.dataset.updatedAt,
      created_by: btn.dataset.createdBy,
      updated_by: btn.dataset.updatedBy,
      description: btn.dataset.description,
      emails: btn.dataset.emails
    };

    openModal(data);
  });

  overlay?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });
});


