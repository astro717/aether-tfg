import * as Joi from 'joi';

export const configurationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection URL'),

  // Server
  PORT: Joi.number().default(3000),

  // JWT Authentication
  JWT_SECRET: Joi.string().required().description('Secret key for JWT tokens'),

  // GitHub Integration
  GITHUB_CLIENT_ID: Joi.string().required().description('GitHub OAuth App Client ID'),
  GITHUB_CLIENT_SECRET: Joi.string().required().description('GitHub OAuth App Client Secret'),
  KEY_GITHUB_TOKEN: Joi.string().required().description('GitHub Personal Access Token for API operations'),

  // AI Integration
  GEMINI_API_KEY: Joi.string().required().description('Google Gemini API Key'),

  // Supabase Storage
  SUPABASE_URL: Joi.string().required().description('Supabase Project URL'),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required().description('Supabase Service Role Key (admin)'),
});

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    token: process.env.KEY_GITHUB_TOKEN,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
});
