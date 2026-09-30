export abstract class TaskNumberPort {
  /**
   * Атомарно выдаёт следующий порядковый номер задачи в проекте и двигает
   * счётчик проекта. Номера только растут и не переиспользуются.
   *
   * @param projectId id проекта или `null` для задачи во Входящих.
   * @returns номер, начиная с 1, для agile-проекта; `null` для `null`,
   * несуществующего и обычного (не agile) проекта. Запрос к БД при
   * `projectId = null` не выполняется.
   */
  abstract allocate(projectId: string | null): Promise<number | null>;
}
