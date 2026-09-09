/**
 * EhrShell — Bloom redesign (maio/2026).
 *
 * The legacy dark "EHR" shell was retired. This file now exports the
 * new Bloom ProShell so route configs that reference EhrShell keep
 * working without touching the routing tree.
 */
import { ProShell } from "./ProShell";

export default ProShell;
