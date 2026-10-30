export async function auth() {
  if (process.env.NODE_ENV === "development" && !process.env.VITEST) {
    return {
      user: {
        id: "user_admin",
        name: "Admin User",
        email: "admin@cyberrisk.local",
        role: "admin",
        organizationId: "org_default",
      },
    };
  }
  return null;
}
