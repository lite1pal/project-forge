import { loadRuntimeConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";

loadRuntimeConfig(loadEnvFiles());
