/**
 * Классы сетки таблицы гостей. Живут отдельно, потому что ячейки строки
 * рендерят два компонента — GuestsTable (режим просмотра) и
 * GuestFormFields (режим правки) — и разъехавшиеся отступы или границы
 * сразу видны как сбитая сетка при переключении строки в редактирование.
 *
 * Сетка строится на border-separate, а не border-collapse: у collapse
 * границы принадлежат таблице, а не ячейке, и на закреплённой колонке
 * уезжают из-под неё при горизонтальном скролле.
 */
export const cellClass = 'px-3 py-2 align-top whitespace-nowrap border-b border-r border-default'

export const headCellClass = `${cellClass} font-medium text-left bg-elevated`

/**
 * Колонка действий закреплена справа: собственный фон обязателен, иначе
 * уезжающие под неё ячейки просвечивают, а левая граница отбивает её от
 * прокручиваемой части.
 */
export const stickyCellClass = `${cellClass} sticky right-0 z-10 bg-[var(--linen)] border-l-2 border-l-default`

export const stickyHeadCellClass = `${headCellClass} sticky right-0 z-20 border-l-2 border-l-default`
