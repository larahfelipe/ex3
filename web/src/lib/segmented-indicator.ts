export type IndicatorBox = Record<'x' | 'y' | 'width' | 'height', number>;

/** Where the indicator stands, under which option, and whether it is sliding there from another. */
export type IndicatorPlacement = Record<'value', string> &
  Record<'box', IndicatorBox> &
  Record<'isSliding', boolean>;

/** What moved the indicator: the checked option changed, or the group or its options resized. */
export type PlacementCause = 'selection' | 'resize';

type Rect = Record<'left' | 'top' | 'width' | 'height', number>;

/** The group's rect on screen, with its untransformed size and the offsets of its padding box. */
export type GroupMetrics = Rect &
  Record<
    | 'layoutWidth'
    | 'layoutHeight'
    | 'clientLeft'
    | 'clientTop'
    | 'scrollLeft'
    | 'scrollTop',
    number
  >;

const BOX_KEYS = ['x', 'y', 'width', 'height'] as const;

/** Below a hundredth of a pixel two measurements of one layout differ only by rounding. */
const BOX_TOLERANCE = 0.01;

/** A size not laid out, being hidden, is zero, or `NaN` when read from a computed `auto`. */
const isLaidOut = (size: number) => size > 0;

/**
 * The option's box within the group's padding box, in the group's own pixels,
 * so it stays put however the page around the group moves. A transform on an
 * ancestor, such as a dialog scaling in, scales both rects alike and is divided
 * out. A group or an option not laid out has no box.
 */
export const boxWithin = (
  group: GroupMetrics,
  option: Rect
): IndicatorBox | null => {
  const sizes = [
    group.width,
    group.height,
    group.layoutWidth,
    group.layoutHeight,
    option.width,
    option.height
  ];

  if (!sizes.every(isLaidOut)) return null;

  const scaleX = group.width / group.layoutWidth;
  const scaleY = group.height / group.layoutHeight;

  return {
    x:
      (option.left - group.left) / scaleX - group.clientLeft + group.scrollLeft,
    y: (option.top - group.top) / scaleY - group.clientTop + group.scrollTop,
    width: option.width / scaleX,
    height: option.height / scaleY
  };
};

const isSameBox = (left: IndicatorBox, right: IndicatorBox) =>
  BOX_KEYS.every((key) => Math.abs(left[key] - right[key]) < BOX_TOLERANCE);

/**
 * Where the indicator goes next. It slides only when the checked option
 * changes from one it already stood under, and keeps sliding when a resize
 * moves its target mid-slide. Any other move, the page reflowing around the
 * group or a breakpoint rearranging its options, puts it in place at once.
 * Returns `previous` itself when nothing changed.
 */
export const nextPlacement = (
  previous: IndicatorPlacement | null,
  value: string | null,
  box: IndicatorBox | null,
  cause: PlacementCause
): IndicatorPlacement | null => {
  if (value === null || box === null) return null;

  const isSliding =
    previous === null
      ? false
      : previous.value === value
        ? previous.isSliding
        : cause === 'selection';

  if (
    previous !== null &&
    previous.value === value &&
    previous.isSliding === isSliding &&
    isSameBox(previous.box, box)
  )
    return previous;

  return { value, box, isSliding };
};

/** Once a slide ends, a later move is a layout change, not a selection. */
export const settledPlacement = (
  placement: IndicatorPlacement | null
): IndicatorPlacement | null =>
  placement === null || !placement.isSliding
    ? placement
    : { ...placement, isSliding: false };
