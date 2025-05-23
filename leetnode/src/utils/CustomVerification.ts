// Credits: https://github.com/lukevella/rallly/pull/909/commits/8b5dcbda0dee0aeda2efb1fc6d19597194026c90
// NOTE: Some users have inboxes with spam filters that check all links before they are delivered.
// This means the verification link will be used before the user gets it. To get around this, we
// avoid deleting the verification token when it is used. Instead we delete all verification tokens
// for an email address when a new verification token is created.

import { Prisma } from '@prisma/client';
import { prisma } from "@/server/db/client";
import { Adapter } from "next-auth/adapters";

export function VerificationTokenFixAdapter(adapter: Adapter): Adapter {
  return {
    ...adapter,
    async createVerificationToken(data) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: data.identifier },
      });

      const verificationToken = await prisma.verificationToken.create({
        data,
      });

      return verificationToken;
    },
    async useVerificationToken(identifier_token) {
      // NOTE: Some users have inboxes with spam filters that check all links before they are delivered.
      // This means the verification link will be used before the user gets it. To get around this, we
      // avoid deleting the verification token for now.
      try {
        const verificationToken = await prisma.verificationToken.findUnique({
          where: { identifier_token },
        });
        return verificationToken;
      } catch (error) {
        // https://www.prisma.io/docs/reference/api-reference/error-reference#p2025
        if ((error as Prisma.PrismaClientKnownRequestError).code === "P2025")
          return null;
        throw error;
      }
    },
  };
}