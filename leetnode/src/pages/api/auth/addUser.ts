import { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/server/db/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const isEmailAllowed = await prisma.user.findFirst({
    where: {
      email: req.query.email as string,
    },
  });

  if (isEmailAllowed) {
    return res.status(200).json({
      message: "Email already invited, please check your inbox and junk mail!",
      customIcon: "📫",
      addedToUsers: false,
    });
  }

  await prisma.user.upsert({
    where: {
      email: req.query.email as string,
    },
    update: {},
    create: {
      email: req.query.email as string,
      loginStreak: 0,
      points: 0,
      username: req.query.email as string,
      role: "USER",
      isNewUser: true,
    },
  });

  res.status(201).json({
    message: "Added to users!",
    customIcon: "🎉",
    addedToUsers: true,
  });
}
