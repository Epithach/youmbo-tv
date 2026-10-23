import { createMemo, For, type JSX } from 'solid-js';

interface WindowedListProps<T> {
  items: readonly T[];
  selected: number;
  active: boolean;
  /** Nombre de lignes rendues : seules celles-ci existent dans le DOM. */
  visibleRows: number;
  onSelect: (index: number) => void;
  onActivate?: (index: number) => void;
  children: (item: T, index: number) => JSX.Element;
}

/**
 * Liste « fenêtrée » pilotée par la sélection : on ne rend que les lignes
 * autour de l'élément sélectionné. Indispensable sur TV, où rendre des
 * milliers de chaînes ferait ramer le moteur web.
 */
export function WindowedList<T>(props: WindowedListProps<T>) {
  const start = createMemo(() => {
    const maxStart = Math.max(0, props.items.length - props.visibleRows);
    const centered = props.selected - Math.floor(props.visibleRows / 2);
    return Math.min(Math.max(0, centered), maxStart);
  });

  const rows = createMemo(() =>
    props.items.slice(start(), start() + props.visibleRows).map((item, offset) => ({
      item,
      index: start() + offset,
    })),
  );

  const onWheel = (event: WheelEvent) => {
    const next = props.selected + (event.deltaY > 0 ? 1 : -1);
    if (next >= 0 && next < props.items.length) props.onSelect(next);
  };

  return (
    <ul class="list" classList={{ 'list--active': props.active }} onWheel={onWheel}>
      <For each={rows()}>
        {(row) => (
          <li
            class="list__row"
            classList={{ 'list__row--selected': row.index === props.selected }}
            onClick={() => {
              props.onSelect(row.index);
              props.onActivate?.(row.index);
            }}
          >
            {props.children(row.item, row.index)}
          </li>
        )}
      </For>
    </ul>
  );
}
