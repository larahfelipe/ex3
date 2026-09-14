export type Page<Item> = {
  items: Array<Item>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
