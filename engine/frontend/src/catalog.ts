// The 10 business-priority reports, in their agreed order. The nav bar always lists all 10. A report opens when the
// engine has it (built, and in the online copy: its DEV export is loaded); otherwise its page says why it cannot show.
export type CatalogEntry = { no: number; id: string; title: string; jira?: string; whyNot?: string };

export const CATALOG: CatalogEntry[] = [
  { no: 1, id: 'tender-report', title: 'Tender Report', jira: 'AG-66' },
  { no: 2, id: 'waste-report', title: 'Detailed Waste Report' },
  { no: 3, id: 'market-category', title: 'Market Category' },
  { no: 4, id: 'people-count', title: 'People Count', whyNot: 'The people_count table is empty on DEV, so there is nothing to show yet.' },
  { no: 5, id: 'radar-car-count', title: 'Radar Car Count', whyNot: 'The car_count table is empty on DEV, and no table holds the car / truck split.' },
  { no: 6, id: 'sales-margin-budget', title: 'Sales and Margin with Budget', jira: 'AG-76' },
  { no: 7, id: 'sales-report-1', title: 'Sales Report 1', jira: 'AG-79' },
  { no: 8, id: 'sales-budget-2026', title: 'Sales Report - Budget 2026', jira: 'AG-80' },
  { no: 9, id: 'sales-field-team', title: 'Sales Report Field Team', jira: 'AG-81' },
  { no: 10, id: 'financial-reports', title: 'Financial Reports', jira: 'AG-82' },
];
