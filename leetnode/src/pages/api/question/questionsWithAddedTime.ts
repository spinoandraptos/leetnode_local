import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/server/db/client";
import { QuestionDataType } from "@/types/question-types";
import { CustomEval } from "@/utils/CustomEval";
import { CustomMath } from "@/utils/CustomMath";
import { RecommendQuestion } from "@/utils/Recommender";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  // Exclude 2025 Questions from the bank temporarily
  const excluded2025QuestionIds = [
    89, 98, 90, 91, 92, 93, 94, 95, 96, 97,
    79, 106, 107, 108, 99, 74, 100, 101, 102, 103, 104, 105
  ];

  const prevId = req.query.prevId as string
  if (prevId) {
    const numericPrevId = parseInt(prevId, 10);
  
    if (!excluded2025QuestionIds.includes(numericPrevId)) {
      excluded2025QuestionIds.push(numericPrevId);
    }
  }

  // Questions specific to user and course, newest first
  let userCourseQuestionsWithAddedTime =
    await prisma.questionWithAddedTime.findFirst({
      where: {
        userId: session?.user?.id,
        courseSlug: req.query.courseSlug as string,
        NOT: {
          questionId: {
            in: excluded2025QuestionIds,
          },
        },
      },
      include: {
        question: {
          include: {
            topic: {
              select: {
                topicName: true,
              },
            },
          },
        },
      },
      orderBy: {
        addedTime: "desc",
      },
    });

  // If no questions for this user and for this course yet, recommend a question from the course
  if (!userCourseQuestionsWithAddedTime) {
    const { recommendedTopicName, recommendedQuestion } =
      await RecommendQuestion(req.query.courseSlug as string, 0);

    const questionData = recommendedQuestion.questionData as QuestionDataType;

    let evaluatedQuestionData;
    if (recommendedQuestion.variationId === 0) {
      evaluatedQuestionData = CustomEval(
        questionData.variables,
        questionData.methods
      );
    }

    const recommendedQuestionsWithAddedTime =
      await prisma.questionWithAddedTime.create({
        data: {
          userId: session?.user?.id as string,
          courseSlug: req.query.courseSlug as string,
          questionId: recommendedQuestion.questionId,
          variationId: recommendedQuestion.variationId,
          variables:
            evaluatedQuestionData?.questionVariables ?? questionData.variables,
          answers: CustomMath.shuffleArray(
            questionData.answers ?? evaluatedQuestionData?.questionAnswers
          ) as QuestionDataType["answers"],
        },
      });

    userCourseQuestionsWithAddedTime = {
      ...recommendedQuestionsWithAddedTime,
      question: {
        ...recommendedQuestion,
        topic: {
          topicName: recommendedTopicName,
        },
      },
    };
  }

  res.status(200).json(userCourseQuestionsWithAddedTime);
}
