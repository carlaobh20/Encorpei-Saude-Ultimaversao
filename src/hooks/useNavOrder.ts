import { useState, useCallback, useEffect } from "react";
import {
  NAV_GROUP_KEYS,
  NAV_STRUCTURE,
  type NavGroup,
  type NavGroupKey,
  type NavItem,
} from "@/config/navigation";

const STORAGE_KEY = "encorpei_nav_order";
const NAV_VERSION_KEY = "encorpei_nav_version";
// Bump this whenever NAV_STRUCTURE or persistence shape changes to force reset of stale orders
const NAV_VERSION = 11;

export type PersistedNavOrder = Record<NavGroupKey, string[]>;

interface OrderedNavGroup extends Omit<NavGroup, "items"> {
  items: NavItem[];
}

function createEmptyOrder(): PersistedNavOrder {
  return Object.fromEntries(NAV_GROUP_KEYS.map((key) => [key, []])) as PersistedNavOrder;
}

function getDefaultOrder(): PersistedNavOrder {
  return NAV_STRUCTURE.reduce((acc, group) => {
    acc[group.key] = group.items.map((item) => item.id);
    return acc;
  }, createEmptyOrder());
}

function getDefaultGroups(): OrderedNavGroup[] {
  return NAV_STRUCTURE.map((group) => ({
    ...group,
    items: [...group.items],
  }));
}

function serializeGroups(groups: OrderedNavGroup[]): PersistedNavOrder {
  const serialized = createEmptyOrder();

  for (const group of groups) {
    serialized[group.key] = group.items.map((item) => item.id);
  }

  return serialized;
}

function normalizeGroupIds(group: NavGroup, candidate: unknown): string[] {
  const validIds = new Set(group.items.map((item) => item.id));
  const orderedIds: string[] = [];

  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      if (typeof value !== "string" || !validIds.has(value) || orderedIds.includes(value)) {
        continue;
      }

      orderedIds.push(value);
    }
  }

  for (const item of group.items) {
    if (!orderedIds.includes(item.id)) {
      orderedIds.push(item.id);
    }
  }

  return orderedIds;
}

function orderGroupItems(group: NavGroup, orderedIds: string[]): NavItem[] {
  const itemMap = new Map(group.items.map((item) => [item.id, item]));

  return orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is NavItem => Boolean(item));
}

export function buildGroupsFromOrder(order: PersistedNavOrder): OrderedNavGroup[] {
  return NAV_STRUCTURE.map((group) => ({
    ...group,
    items: orderGroupItems(group, order[group.key]),
  }));
}

function parseStoredOrder(raw: string | null): Partial<Record<NavGroupKey, unknown>> | null {
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Partial<Record<NavGroupKey, unknown>>;
}

export function reconcilePersistedOrder(storedOrder: Partial<Record<NavGroupKey, unknown>> | null): PersistedNavOrder {
  const reconciled = createEmptyOrder();

  for (const group of NAV_STRUCTURE) {
    reconciled[group.key] = normalizeGroupIds(group, storedOrder?.[group.key]);
  }

  return reconciled;
}

function getDefaultGroup(groupKey: NavGroupKey): NavGroup {
  const defaultGroup = NAV_STRUCTURE.find((group) => group.key === groupKey);

  if (!defaultGroup) {
    throw new Error(`Unknown navigation group: ${groupKey}`);
  }

  return defaultGroup;
}

function loadOrder(): OrderedNavGroup[] {

  try {
    const storedVersion = localStorage.getItem(NAV_VERSION_KEY);
    if (storedVersion !== String(NAV_VERSION)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(NAV_VERSION_KEY, String(NAV_VERSION));

      const defaults = getDefaultGroups();
      return defaults;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const parsedOrder = parseStoredOrder(stored);

    const reconciledOrder = reconcilePersistedOrder(parsedOrder);
    const groups = buildGroupsFromOrder(reconciledOrder);

    return groups;
  } catch (error) {
    console.error("[sidebar] Failed to load navigation order", error);
    const defaults = getDefaultGroups();
    return defaults;
  }
}

export function useNavOrder() {
  const [groups, setGroups] = useState<OrderedNavGroup[]>(loadOrder);

  useEffect(() => {
    const serialized = serializeGroups(groups);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    localStorage.setItem(NAV_VERSION_KEY, String(NAV_VERSION));
  }, [groups]);

  const reorderGroup = useCallback((groupKey: NavGroupKey, newItemIds: string[]) => {
    const defaultGroup = getDefaultGroup(groupKey);
    const nextIds = normalizeGroupIds(defaultGroup, newItemIds);

    setGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.key !== groupKey) return group;

        return {
          ...group,
          items: orderGroupItems(defaultGroup, nextIds),
        };
      })
    );
  }, []);

  const resetOrder = useCallback(() => {
    const defaults = getDefaultGroups();
    setGroups(defaults);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(NAV_VERSION_KEY, String(NAV_VERSION));
  }, []);

  return { groups, reorderGroup, resetOrder };
}

export type { OrderedNavGroup };
