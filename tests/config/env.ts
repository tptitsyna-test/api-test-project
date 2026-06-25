function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}

export const testUser = {
  id: Number(requiredEnv('TEST_USER_ID')),
  username: requiredEnv('TEST_USERNAME'),
  password: requiredEnv('TEST_PASSWORD'),
  email: requiredEnv('TEST_USER_EMAIL'),
};
