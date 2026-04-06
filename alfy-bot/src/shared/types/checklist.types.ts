export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

export interface ChecklistData {
  items: ChecklistItem[];
}
