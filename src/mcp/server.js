import { createBrainSession } from "./session.js";
import { attachStdio, resolveProjectPathFromEnv } from "./protocol.js";

const projectPath = resolveProjectPathFromEnv();
const session = createBrainSession({ projectPath });
attachStdio(session, process.stdin, process.stdout);
