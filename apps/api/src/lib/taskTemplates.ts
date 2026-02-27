type TemplateTask = {
  title: string;
  daysBeforeEvent: number;
};

type EventTemplateTaskInput = {
  title: string;
  dueAt: Date;
  status: 'TODO';
};

const indoorTasks: TemplateTask[] = [
  { title: 'Finalize in-store theme and run-of-show', daysBeforeEvent: 14 },
  { title: 'Submit marketing asset request', daysBeforeEvent: 12 },
  { title: 'Post weekly teaser', daysBeforeEvent: 5 },
  { title: 'Send CRM reminder email', daysBeforeEvent: 4 },
  { title: 'Confirm vendors/deliveries', daysBeforeEvent: 1 },
  { title: 'Event day setup checklist', daysBeforeEvent: 0 },
  { title: 'Post-event recap within 24h', daysBeforeEvent: -1 }
];

const outdoorTasks: TemplateTask[] = [
  { title: 'Secure permits and outdoor layout', daysBeforeEvent: 21 },
  { title: 'Book vendors/charity partners', daysBeforeEvent: 14 },
  { title: 'Submit marketing asset request', daysBeforeEvent: 12 },
  { title: 'Post weekly teaser', daysBeforeEvent: 5 },
  { title: 'Send CRM reminder email', daysBeforeEvent: 4 },
  { title: 'Confirm weather contingency plan', daysBeforeEvent: 2 },
  { title: 'Event day setup checklist', daysBeforeEvent: 0 },
  { title: 'Post-event recap within 24h', daysBeforeEvent: -1 }
];

export function buildTemplateTasks(
  eventDate: Date,
  seasonType: 'INDOOR' | 'OUTDOOR'
): EventTemplateTaskInput[] {
  const source = seasonType === 'INDOOR' ? indoorTasks : outdoorTasks;

  return source.map((task) => {
    const dueAt = new Date(eventDate);
    dueAt.setDate(dueAt.getDate() - task.daysBeforeEvent);

    return {
      title: task.title,
      dueAt,
      status: 'TODO'
    };
  });
}
