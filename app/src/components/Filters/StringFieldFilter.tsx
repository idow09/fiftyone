import React from "react";
import {
  atomFamily,
  DefaultValue,
  GetRecoilValue,
  selectorFamily,
  SetRecoilState,
} from "recoil";
import { animated } from "react-spring";

import * as selectors from "../../recoil/selectors";
import { NamedStringFilter } from "./StringFilter";
import { AGGS } from "../../utils/labels";
import { useExpand, hasNoneField } from "./utils";

type StringFilter = {
  values: string[];
  none: boolean;
  _CLS: string;
};

type Value = string | null;

const getFilter = (get: GetRecoilValue, path: string): StringFilter => {
  return {
    ...{
      values: [],
    },
    ...get(selectors.filterStage(path)),
  };
};

const meetsDefault = (filter: StringFilter) => filter.values.length === 0;

const setFilter = (
  get: GetRecoilValue,
  set: SetRecoilState,
  path: string,
  key: string,
  value: boolean | string[] | DefaultValue
) => {
  const filter = {
    ...getFilter(get, path),
    [key]: value,
    _CLS: "str",
  };
  if (meetsDefault(filter)) {
    set(selectors.filterStage(path), null);
  } else {
    set(selectors.filterStage(path), filter);
  }
};

export const selectedValuesAtom = selectorFamily<Value[], string>({
  key: "filterStringFieldValues",
  get: (path) => ({ get }) => getFilter(get, path).values,
  set: (path) => ({ get, set }, value) =>
    setFilter(get, set, path, "values", value),
});

export const selectedValuesModalAtom = atomFamily<Value[], string>({
  key: "modalFilterStringFieldValues",
  default: [],
});

export const valuesAtom = selectorFamily<Value[], string>({
  key: "stringFieldValues",
  get: (path) => ({ get }) => {
    let i = (get(selectors.datasetStats) ?? []).reduce((acc, cur) => {
      if (cur.name === path && cur._CLS === AGGS.DISTINCT) {
        return cur.result;
      }
      return acc;
    }, []);
    if (get(hasNoneField(path))) {
      return [null, ...i];
    }
    return i;
  },
});

export const fieldIsFiltered = selectorFamily<
  boolean,
  { path: string; modal?: boolean }
>({
  key: "stringFieldIsFiltered",
  get: ({ path, modal }) => ({ get }) => {
    const values = modal ? selectedValuesModalAtom : selectedValuesAtom;
    return Boolean(get(values(path)).length);
  },
});

const StringFieldFilter = ({ expanded, entry }) => {
  const [ref, props] = useExpand(expanded);

  return (
    <animated.div style={props}>
      <NamedStringFilter
        name={"Values"}
        valueName={"value"}
        color={entry.color}
        valuesAtom={valuesAtom(entry.path)}
        selectedValuesAtom={selectedValuesAtom(entry.path)}
        ref={ref}
      />
    </animated.div>
  );
};

export default React.memo(StringFieldFilter);
