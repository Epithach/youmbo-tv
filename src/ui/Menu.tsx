import { For, Show } from 'solid-js';

export interface MenuItem {
  label: string;
  /** Texte secondaire (valeur d'un réglage, explication). */
  detail?: string;
  disabled?: boolean;
  onPress: () => void;
}

interface MenuProps {
  items: MenuItem[];
  selected: number;
  onSelect: (index: number) => void;
  direction?: 'row' | 'column';
}

/** Liste de gros boutons, pensée pour la télécommande (la sélection vient du parent). */
export function Menu(props: MenuProps) {
  return (
    <div class="menu" classList={{ 'menu--row': props.direction === 'row' }}>
      <For each={props.items}>
        {(item, index) => (
          <button
            type="button"
            class="menu__item"
            classList={{
              'menu__item--selected': index() === props.selected,
              'menu__item--disabled': item.disabled,
            }}
            onMouseEnter={() => props.onSelect(index())}
            onClick={() => !item.disabled && item.onPress()}
          >
            <span class="menu__label">{item.label}</span>
            <Show when={item.detail}>
              <span class="menu__detail">{item.detail}</span>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}

/** Déclenche l'élément sélectionné, sauf s'il est désactivé. */
export function pressMenuItem(items: MenuItem[], index: number) {
  const item = items[index];
  if (item && !item.disabled) item.onPress();
}
