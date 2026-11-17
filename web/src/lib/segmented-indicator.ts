export type IndicatorBox = Record<'x' | 'y' | 'width' | 'height', number>;

export type IndicatorPlacement = Record<'value', string> &
  Record<'box', IndicatorBox> &
  Record<'isSliding', boolean>;

export type PlacementCause = 'selection' | 'resize';

type Rect = Record<'left' | 'top' | 'width' | 'height', number>;

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

const BOX_TOLERANCE = 0.01;

const isLaidOut = (size: number) => size > 0;

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

export const settledPlacement = (
  placement: IndicatorPlacement | null
): IndicatorPlacement | null =>
  placement === null || !placement.isSliding
    ? placement
    : { ...placement, isSliding: false };
