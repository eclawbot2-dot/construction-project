import "next-auth";
import "next-auth/jwt";
import "@auth/core/types";
import "@auth/core/jwt";

declare module "@auth/core/types" {
  interface Session {
    userId?: string;
    superAdmin?: boolean;
  }

  interface User {
    superAdmin?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    superAdmin?: boolean;
  }
}

declare module "next-auth" {
  interface Session {
    userId?: string;
    superAdmin?: boolean;
  }

  interface User {
    superAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    superAdmin?: boolean;
  }
}
