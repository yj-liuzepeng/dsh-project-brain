// 技术栈展示口径：运行时主视野 / 交付（CI·IaC·观测） / 工程工具另计
// 语言名不进框架 chip（语言统计卡片已经展示）

export const RUNTIME_STACK_FIELDS = [
  "framework-frontend", "framework-backend", "framework-fullstack",
  "webserver", "database", "cache", "queue", "search",
  "container", "mobile", "desktop",
  "auth", "api", "payment", "ai", "orm",
];

export const DEVOPS_STACK_FIELDS = ["iac", "ci", "observability"];

export const LANGUAGE_NAMES = new Set([
  "JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C", "C++",
  "Kotlin", "Scala", "Swift", "Dart", "C#", ".NET", "PHP", "Ruby",
]);

const TECHSTACK_TO_STACK_FIELD = {
  frontend: "framework-frontend",
  backend: "framework-backend",
  fullstack: "framework-fullstack",
  webserver: "webserver",
  database: "database",
  cache: "cache",
  queue: "queue",
  search: "search",
  container: "container",
  mobile: "mobile",
  desktop: "desktop",
  auth: "auth",
  api: "api",
  payment: "payment",
  ai: "ai",
  orm: "orm",
  iac: "iac",
  ci: "ci",
  observability: "observability",
};

export function isLanguageTech(name) {
  return LANGUAGE_NAMES.has(name);
}

export function itemsOf(map, field) {
  const value = map && map[field];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return value ? [String(value)] : [];
}

function pushUnique(target, field, item) {
  if (!item) return;
  if (!Array.isArray(target[field])) target[field] = [];
  if (!target[field].includes(item)) target[field].push(item);
}

function extraOf(map) {
  return itemsOf(map, "_extra").filter((item) => !isLanguageTech(item));
}

export function partitionStack(stack) {
  const runtime = {};
  const devops = {};
  for (const field of RUNTIME_STACK_FIELDS) {
    const items = itemsOf(stack, field);
    if (items.length) runtime[field] = items;
  }
  for (const field of DEVOPS_STACK_FIELDS) {
    const items = itemsOf(stack, field);
    if (items.length) devops[field] = items;
  }
  return { runtime, devops, extra: extraOf(stack) };
}

export function fallbackFromTechStack(techStack, existingStructure) {
  const runtime = {};
  const devops = {};
  const structure = Array.isArray(existingStructure) ? existingStructure.slice() : [];
  for (const [key, raw] of Object.entries(techStack || {})) {
    if (key === "_extra") continue;
    const values = Array.isArray(raw) ? raw.filter(Boolean).map(String) : (raw ? [String(raw)] : []);
    if (key === "structure") {
      for (const item of values) {
        if (!structure.includes(item)) structure.push(item);
      }
      continue;
    }
    const field = TECHSTACK_TO_STACK_FIELD[key];
    if (!field) continue;
    const target = DEVOPS_STACK_FIELDS.includes(field) ? devops : runtime;
    for (const item of values) {
      if (isLanguageTech(item)) continue;
      pushUnique(target, field, item);
    }
  }
  return { runtime, devops, extra: extraOf(techStack), structure };
}

function mergeStructure(structure, techStack) {
  const out = [];
  for (const item of [...(Array.isArray(structure) ? structure : []), ...itemsOf(techStack, "structure")]) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function previewStackLayers({ stack, techStack, structure }) {
  const partitioned = partitionStack(stack || {});
  const hasRuntime = Object.keys(partitioned.runtime).length > 0;
  const hasDevops = Object.keys(partitioned.devops).length > 0;
  const hasExtra = partitioned.extra.length > 0;
  const mergedStructure = mergeStructure(structure, techStack);
  if (hasRuntime || hasDevops || hasExtra) {
    return {
      runtime: partitioned.runtime,
      devops: partitioned.devops,
      extra: partitioned.extra,
      structure: mergedStructure,
      usedFallback: false,
    };
  }
  const fallback = fallbackFromTechStack(techStack || {}, mergedStructure);
  return Object.assign({ usedFallback: true }, fallback);
}

export const STACK_FIELD_TO_TECHSTACK = Object.fromEntries(
  Object.entries(TECHSTACK_TO_STACK_FIELD).map(([legacy, field]) => [field, legacy]),
);

const TECHSTACK_CATEGORY_MAP = {
  "React": ["frontend"], "Vue": ["frontend"], "Svelte": ["frontend"], "Angular": ["frontend"], "Solid": ["frontend"],
  "Next.js": ["fullstack"], "Nuxt": ["fullstack"], "Remix": ["fullstack"], "Astro": ["fullstack"],
  "Express": ["backend"], "Fastify": ["backend"], "NestJS": ["backend"], "Koa": ["backend"],
  "FastAPI": ["backend"], "Django": ["backend"], "Flask": ["backend"],
  "Gin": ["backend"], "Echo": ["backend"], "Fiber": ["backend"],
  "Actix Web": ["backend"], "Axum": ["backend"], "Rocket": ["backend"],
  "Spring": ["backend"], "Spring Boot": ["backend"],
  "Electron": ["desktop"], "Tauri": ["desktop"], "Tauri Apps": ["desktop"],
  "Prisma": ["orm"], "TypeORM": ["orm"], "Sequelize": ["orm"], "Drizzle": ["orm"],
  "GORM": ["orm"], "SQLAlchemy": ["orm"], "SQLx": ["orm"], "Diesel": ["orm"], "SeaORM": ["orm"],
  "PostgreSQL": ["database"], "MySQL": ["database"], "MongoDB": ["database"], "Redis": ["cache"], "SQLite": ["database"],
  "LangChain": ["ai"], "LangGraph": ["ai"], "OpenAI SDK": ["ai"],
  "MCP": ["api"],
};

const STACK_CATEGORY_MAP = {
  "React": ["framework-frontend"], "Vue": ["framework-frontend"], "Svelte": ["framework-frontend"], "Angular": ["framework-frontend"], "Solid": ["framework-frontend"],
  "Next.js": ["framework-fullstack"], "Nuxt": ["framework-fullstack"], "Remix": ["framework-fullstack"], "Astro": ["framework-fullstack"],
  "Express": ["framework-backend"], "Fastify": ["framework-backend"], "NestJS": ["framework-backend"], "Koa": ["framework-backend"], "Hono": ["framework-backend"],
  "FastAPI": ["framework-backend"], "Django": ["framework-backend"], "Flask": ["framework-backend"], "Streamlit": ["framework-frontend"], "Gradio": ["framework-frontend"],
  "Gin": ["framework-backend"], "Echo": ["framework-backend"], "Fiber": ["framework-backend"],
  "Actix Web": ["framework-backend"], "Axum": ["framework-backend"], "Rocket": ["framework-backend"],
  "Spring": ["framework-backend"], "Spring Boot": ["framework-backend"], "Quarkus": ["framework-backend"], "Micronaut": ["framework-backend"],
  "Electron": ["desktop"], "Tauri": ["desktop"], "Tauri Apps": ["desktop"], "Flutter": ["mobile"], "React Native": ["mobile"], "Expo": ["mobile"],
  "Prisma": ["orm"], "TypeORM": ["orm"], "Sequelize": ["orm"], "Drizzle": ["orm"],
  "GORM": ["orm"], "SQLAlchemy": ["orm"], "SQLx": ["orm"], "Diesel": ["orm"], "SeaORM": ["orm"], "Hibernate": ["orm"], "MyBatis": ["orm"],
  "PostgreSQL": ["database"], "MySQL": ["database"], "MongoDB": ["database"], "Redis": ["cache"], "SQLite": ["database"],
  "MariaDB": ["database"], "ClickHouse": ["database"], "Cassandra": ["database"], "InfluxDB": ["database"],
  "Elasticsearch": ["search"], "OpenSearch": ["search"], "Meilisearch": ["search"], "Algolia": ["search"],
  "RabbitMQ": ["queue"], "Kafka": ["queue"], "NATS": ["queue"], "Bull": ["queue"], "Celery": ["queue"],
  "Nginx": ["webserver"], "Caddy": ["webserver"], "Traefik": ["webserver"], "Apache": ["webserver"], "HAProxy": ["webserver"],
  "Docker": ["container"], "Docker Compose": ["container"], "Podman": ["container"],
  "Kubernetes": ["iac"],
  "Terraform": ["iac"], "Pulumi": ["iac"], "Ansible": ["iac"], "CloudFormation": ["iac"], "Bicep": ["iac"], "Helm": ["iac"], "Kustomize": ["iac"],
  "GitHub Actions": ["ci"], "GitLab CI": ["ci"], "CircleCI": ["ci"], "Jenkins": ["ci"], "Travis CI": ["ci"], "Azure Pipelines": ["ci"],
  "Prometheus": ["observability"], "Grafana": ["observability"], "Sentry": ["observability"], "OpenTelemetry": ["observability"],
  "Datadog": ["observability"], "Loki": ["observability"], "Jaeger": ["observability"],
  "Passport.js": ["auth"], "Auth.js (NextAuth)": ["auth"], "Clerk": ["auth"], "Auth0": ["auth"],
  "Keycloak": ["auth"], "JWT": ["auth"], "OAuth2/OIDC": ["auth"], "OAuth2": ["auth"],
  "gRPC": ["api"], "GraphQL": ["api"], "tRPC": ["api"], "OpenAPI/Swagger": ["api"], "REST": ["api"], "MCP": ["api"],
  "Stripe": ["payment"], "PayPal": ["payment"],
  "OpenAI SDK": ["ai"], "Anthropic SDK": ["ai"], "Google Generative AI": ["ai"], "Cohere": ["ai"],
  "LangChain": ["ai"], "LangGraph": ["ai"], "LlamaIndex": ["ai"], "Hugging Face": ["ai"], "PyTorch": ["ai"], "TensorFlow": ["ai"],
};

function collectArchitectureTechs(architecture) {
  const allTechs = new Set();
  if (!architecture || !Array.isArray(architecture.components)) return allTechs;
  for (const component of architecture.components) {
    for (const tech of component.technologies || []) allTechs.add(tech);
  }
  return allTechs;
}

export function mergeTechStackWithArchitecture(scanTechStack, architecture) {
  const result = JSON.parse(JSON.stringify(scanTechStack || {}));
  if (!architecture || !Array.isArray(architecture.components)) return result;
  const append = (field, value) => {
    if (!value) return;
    const cur = result[field];
    if (!cur) result[field] = value;
    else if (Array.isArray(cur)) { if (!cur.includes(value)) cur.push(value); }
    else if (cur !== value) result[field] = [cur, value];
  };
  const unmatched = [];
  for (const tech of collectArchitectureTechs(architecture)) {
    if (isLanguageTech(tech)) continue;
    const cats = TECHSTACK_CATEGORY_MAP[tech];
    if (cats) {
      for (const cat of cats) append(cat, tech);
    } else {
      unmatched.push(tech);
    }
  }
  if (unmatched.length) result._extra = unmatched;
  return result;
}

export function mergeStackWithArchitecture(scanStack, architecture) {
  const result = JSON.parse(JSON.stringify(scanStack || {}));
  const push = (field, value) => {
    if (!value) return;
    if (!Array.isArray(result[field])) result[field] = result[field] ? [result[field]] : [];
    if (!result[field].includes(value)) result[field].push(value);
  };
  if (!architecture || !Array.isArray(architecture.components)) return result;
  const unmatched = [];
  for (const tech of collectArchitectureTechs(architecture)) {
    if (isLanguageTech(tech)) continue;
    const cats = STACK_CATEGORY_MAP[tech];
    if (cats) {
      for (const cat of cats) push(cat, tech);
    } else {
      unmatched.push(tech);
    }
  }
  if (unmatched.length) result._extra = Array.from(new Set([...(result._extra || []), ...unmatched]));
  return result;
}
