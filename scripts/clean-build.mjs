import {rm} from 'node:fs/promises';
// Fixed project build target: prevents retired code surviving incremental emissions.
await rm(new URL('../.build/',import.meta.url),{recursive:true,force:true});
