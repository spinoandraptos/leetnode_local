import axios from "axios";
import DOMPurify from "dompurify";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  useMediaQuery, useSessionStorage} from "@mantine/hooks";
import VariablesBox from "@/components/editor/VariablesBox";
import LeetNodeFooter from "@/components/Footer";
import CourseDiscussion from "@/components/course/CourseDiscussion";
import Latex from "@/components/Latex";
import { QuestionDifficultyBadge } from "@/components/misc/Badges";
import { QuestionDataType } from "@/types/question-types";
import { CustomMath } from "@/utils/CustomMath";
import {
  AppShell,
  ActionIcon,
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  Loader,
  Modal,
  Paper,
  Radio,
  Divider,
  Stack,
  Text,
  Tooltip,
  Navbar as Sidebar,
  ScrollArea,
  createStyles,
  useMantineTheme
} from "@mantine/core";
import { Question, QuestionWithAddedTime, User } from "@prisma/client";
import {
  IconChartLine, IconTarget, IconArrowBarLeft, IconZoomQuestion
} from "@tabler/icons";
import { IconBulb } from "@tabler/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ResultsPage from "@/components/course/ResultsPage";
import QuestionHistory from "@/components/course/QuestionHistory";

interface UserData extends User {
  attempts: { [timestamp: string]: number };
}

export type UCQATAnswersType = {
  key: string;
  answerContent: string;
  isCorrect: boolean;
  isLatex: boolean;
}[];

export default function QuizQuestion() {
  const session = useSession();
  const theme = useMantineTheme();
  const { classes, cx } = useStyles();

  const maxQnCount = 15;

  const { data: user } = useQuery({
    queryKey: ["user-consent"],
    queryFn: () =>
      axios.get<{
        name?: string;
        nusnetId?: string;
        consentDate?: Date;
        isNewUser: boolean;
      }>("/api/init"),
  });
  const [qnCount, setQnCount] = useState(0);
  const [active, setActive] = useSessionStorage({
    key: "quizActiveTab",
    defaultValue: (qnCount === maxQnCount || !user?.data.isNewUser) ? "Your Attempt" : "Questions" ,
  });

  const currentCourseSlug = "welcome-quiz" as string;

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [hintsOpened, setHintsOpened] = useState<boolean>(false);

  const { data: UCQAT } = useQuery({
    queryKey: ["get-ucqat"],
    queryFn: () =>
      axios.get<
        QuestionWithAddedTime & {
          question: Question & {
            topic: {
              topicName: string;
            };
          };
        }
      >(`/api/question/questionsWithAddedTime?courseSlug=${currentCourseSlug}`),
  });

  const { mutate: initUser, isLoading: mutationIsLoading } = useMutation({
    mutationFn: () => {
      return axios.put("/api/init")
    },
  });

  const useSubmitAnswer = () => {
    const queryClient = useQueryClient();
    const { mutate: submitAnswer, status: submitAnswerStatus } = useMutation({
      mutationFn: ({
        query,
        body,
      }: {
        query: {
          qatId: string;
          courseSlug: string;
        };
        body: {
          attemptedKeys: string[];
          isCorrect: boolean;
          topicSlug: string;
          topicName: string;
        };
      }) => {
        return axios.post(
          `/api/question/submitAnswer?qatId=${query.qatId}&courseSlug=${query.courseSlug}`,
          body
        );
      },
      onSuccess: (res) => {
        setSelectedKeys([]);
        const { data } = res;
        console.log(data);
        toast(
          `[${data.topic}] Mastery: ${CustomMath.round(
            data.masteryLevel * 100,
            1
          )}%`,
          {
            icon: data.isCorrect ? "🎉" : "💪",
            className: `border border-solid ${
              data.isCorrect ? "border-green-500" : "border-red-500"
            }`,
            position: "top-right",
            duration: 5000,
          }
        );
        setQnCount ((prev) => prev + 1);
        if (qnCount < maxQnCount){
            queryClient.invalidateQueries(["get-ucqat"]);
            queryClient.invalidateQueries(["get-attempts", data.courseSlug]);
            updatePoints(); // Update points for attempting questions
        }
      },
    });

    return {
      submitAnswer,
      submitAnswerStatus,
    };
  };

  const { submitAnswer, submitAnswerStatus } = useSubmitAnswer();

  // Check if first question attempted
  const { data: userInfo } = useQuery<UserData>({
    queryKey: ["userInfo", session?.data?.user?.id],
    queryFn: async () => {
      const res = await axios.post("/api/user", {
        id: session?.data?.user?.id,
      });
      return res?.data;
    },
    enabled: !!session?.data?.user?.id,
  });

  const queryClient = useQueryClient();

  // Award points for attempting a question
  const { mutate: updatePoints } = useMutation(
    async () => {
      if (!!userInfo) {
        const lastActive = new Date(userInfo.lastActive); // get last active

        const res = await axios.post("/api/user/updatePoints", {
          id: session?.data?.user?.id,
          points:
            (userInfo.attempts[lastActive.toDateString()] ?? 0) === 0
              ? userInfo.points + 5 // First question attempted today
              : userInfo.points + 1, // > 1 question attempted today
        });
        return {
          ...res,
          data: {
            ...res.data,
            customIcon: "🎯",
            message: (
              <>
                Question(s) attempted:{" "}
                {(userInfo.attempts[lastActive.toDateString()] ?? 0) + 1} 🔋
                <span className="text-yellow-600">
                  +
                  {(userInfo.attempts[lastActive.toDateString()] ?? 0) === 0
                    ? 5
                    : 1}
                </span>
              </>
            ),
          },
        };
      }
    },
    {
      onSuccess: () => {
        if (qnCount < maxQnCount){
            queryClient.invalidateQueries(["userInfo", session?.data?.user?.id]); // Get latest number of attempts
        }
      },
    }
  );

  if (!UCQAT) {
    return (
      <Center className="h-[calc(100vh-180px)]">
        <Loader />
      </Center>
    );
  }

  if (!UCQAT.data) {
    return (
      <Center className="h-[calc(100vh-180px)]">
        <Text>Stay tuned, more questions are coming your way!</Text>
      </Center>
    );
  }

  const answerOptions = UCQAT.data.answers as QuestionDataType["answers"];

  const correctKeys = answerOptions
    .filter((item) => item.isCorrect)
    .map((item) => item.key);

  const quiz_tabs = {practice: [{label: "Questions", icon: IconZoomQuestion}]};
  const review_tabs = {
      practice: [
        { label: "Your Attempt", icon: IconChartLine },
        { label: "Your Mastery", icon: IconTarget },
      ],
    };
  
  const quiz_links = quiz_tabs["practice"].map(
    (item) =>
      item && (
        <a
          className={cx(classes.link, {
            [classes.linkActive]: item.label === active,
          })}
          key={item.label}
          onClick={(event: { preventDefault: () => void }) => {
            event.preventDefault();
            setActive(item.label);          }}
        >
          <item.icon className={classes.linkIcon} stroke={1.5} />
          <span>{item.label}</span>
        </a>
        )
    );

    const review_links = review_tabs["practice"].map(
      (item) =>
        item && (
          <a
            className={cx(classes.link, {
              [classes.linkActive]: item.label === active,
            })}
            key={item.label}
            onClick={(event: { preventDefault: () => void }) => {
              event.preventDefault();
              setActive(item.label);          }}
          >
            <item.icon className={classes.linkIcon} stroke={1.5} />
            <span>{item.label}</span>
          </a>
          )
      );

    

  if (qnCount === maxQnCount || !user?.data.isNewUser) {
    return (
      <AppShell
      className={classes.appshell}
      navbarOffsetBreakpoint="sm"
      footer={<LeetNodeFooter />}
      navbar={
          <Sidebar
            p="md"
            width={{ sm: 200, lg: 300 }}
            className={classes.navbar}
          >
            <Sidebar.Section>
              <Text weight={600} size="lg" align="center" mb="lg">
                {"Welcome Quiz"}
              </Text>
            </Sidebar.Section>
            <Sidebar.Section mt="xl" grow>
              {review_links}
              <Divider my="sm" variant="dotted" />
              <Link href="/courses" passHref>
                <Box className={classes.link} onClick={() => {
                      initUser();
                    }}>
                  <IconArrowBarLeft className={classes.linkIcon} stroke={1.5} />
                  <span>Proceed to Main Page</span>
                </Box>
              </Link>
            </Sidebar.Section>
          </Sidebar>
      }
    >
      <ScrollArea>
      { active === "Course Discussion" ? (
          <CourseDiscussion courseName={""} />
        ) :active === "Your Attempt" ? (
          <QuestionHistory courseSlug={UCQAT?.data.courseSlug} />
        ) : active === "Your Mastery" ? (
          <ResultsPage />
        ) : (
          <Text>Error</Text>
        )}
      </ScrollArea>
    </AppShell>
    );
  } 
  else return (
    <AppShell
    className={classes.appshell}
    navbarOffsetBreakpoint="sm"
    footer={<LeetNodeFooter />}
    navbar={
        <Sidebar
          p="md"
          width={{ sm: 200, lg: 300 }}
          className={classes.navbar}
        >
          <Sidebar.Section>
            <Text weight={600} size="lg" align="center" mb="lg">
              {"Welcome Quiz"}
            </Text>
          </Sidebar.Section>
          <Sidebar.Section mt="xl" grow>
            {quiz_links}
          </Sidebar.Section>
        </Sidebar>
      }
    >
    <ScrollArea>
      <Paper p="xl" radius="md" withBorder>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedKeys.length === 0) {
              toast.error("Please select an option");
              return;
            }
            submitAnswer({
              query: {
                qatId: UCQAT.data.qatId,
                courseSlug: currentCourseSlug,
              },
              body: {
                attemptedKeys: selectedKeys,
                isCorrect:
                  selectedKeys.length === correctKeys.length &&
                  selectedKeys.every((item) => correctKeys.includes(item)),
                topicSlug: UCQAT.data.question.topicSlug,
                topicName: UCQAT.data.question.topic.topicName,
              },
            });
          }}
        >
          <QuestionDifficultyBadge
            questionDifficulty={UCQAT.data.question.questionDifficulty}
            {...{ radius: "lg", size: "md" }}
          />
          <div
            className="rawhtml mt-4"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(UCQAT.data.question.questionContent, {
                ADD_TAGS: ["iframe"],
                ADD_ATTR: [
                  "allow",
                  "allowfullscreen",
                  "frameborder",
                  "scrolling",
                ],
              }),
            }}
          />
          <VariablesBox
            variables={UCQAT.data.variables as QuestionDataType["variables"]}
          />
          {correctKeys.length === 1 ? (
            <Radio.Group
              mt="xl"
              value={selectedKeys[0]}
              onChange={(value) => {
                console.log(
                  value === answerOptions.find((item) => item.isCorrect)?.key
                );
                setSelectedKeys([value]);
              }}
              orientation="vertical"
              description="Select only one option"
              required
            >
              {answerOptions.map((item) => (
                <Radio
                  key={item.key}
                  value={item.key}
                  label={
                    item.isLatex ? (
                      <Latex>{`$$ ${item.answerContent} $$`}</Latex>
                    ) : (
                      <Text>{item.answerContent}</Text>
                    )
                  }
                  className={`flex items-center justify-start rounded-md border border-solid ${
                    theme.colorScheme === "dark"
                      ? "border-zinc-600 bg-zinc-700"
                      : "border-gray-200 bg-gray-100"
                  } p-2`}
                />
              ))}
            </Radio.Group>
          ) : (
            <Checkbox.Group
              mt="xl"
              value={selectedKeys}
              onChange={(values) => {
                console.log(
                  values.length === correctKeys.length &&
                    values.every((item) => correctKeys.includes(item))
                );
                setSelectedKeys(values);
              }}
              orientation="vertical"
              description="Select all correct options"
              required
            >
              {answerOptions.map((item) => (
                <Checkbox
                  key={item.key}
                  value={item.key}
                  label={
                    item.isLatex ? (
                      <Latex>{item.answerContent}</Latex>
                    ) : (
                      <Text>{item.answerContent}</Text>
                    )
                  }
                  className={`flex items-center justify-start rounded-md border border-solid ${
                    theme.colorScheme === "dark"
                      ? "border-zinc-600 bg-zinc-700"
                      : "border-gray-200 bg-gray-100"
                  } p-2`}
                />
              ))}
            </Checkbox.Group>
          )}
          <Flex mt="xl" align="center" gap="md">
            <Button
              type="submit"
              variant="light"
              fullWidth
              loading={submitAnswerStatus === "loading"}
            >
              {submitAnswerStatus === "loading" ? "Submitting..." : "Submit"}
            </Button>
            {(UCQAT.data.question.questionData as QuestionDataType).hints && (
              <Tooltip label="Hints" withArrow>
                <ActionIcon
                  size="lg"
                  variant="light"
                  radius="xl"
                  onClick={() => setHintsOpened(true)}
                >
                  <IconBulb size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </Flex>
  
          {/* Hints Modal */}
          <Modal
            opened={hintsOpened}
            onClose={() => setHintsOpened(false)}
            title="Hints"
            size="md"
          >
            <Stack>
              {(UCQAT.data.question.questionData as QuestionDataType).hints?.map(
                (item, index) => (
                  <Box
                    key={index}
                    className="flex items-center justify-start gap-3 rounded-md border border-solid border-gray-200 bg-gray-100 p-2"
                  >
                    <Text color="dimmed">#{index + 1}</Text>
                    <Text>{item.hint}</Text>
                  </Box>
                )
              )}
            </Stack>
          </Modal>
        </form>
      </Paper>
      </ScrollArea>
    </AppShell>
    );
}

const useStyles = createStyles((theme, _params, getRef) => {
  const icon = getRef("icon");

  return {
    appshell: {
      main: {
        background:
          theme.colorScheme === "dark"
            ? theme.colors.dark[8]
            : theme.colors.gray[0],
      },
    },

    navbar: {
      backgroundColor:
        theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    },

    link: {
      ...theme.fn.focusStyles(),
      display: "flex",
      alignItems: "center",
      textDecoration: "none",
      fontSize: theme.fontSizes.sm,
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      borderRadius: theme.radius.sm,
      fontWeight: 500,
      cursor: "pointer",

      "&:hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[0],
        color: theme.colorScheme === "dark" ? theme.white : theme.black,

        [`& .${icon}`]: {
          color: theme.colorScheme === "dark" ? theme.white : theme.black,
        },
      },
    },

    linkIcon: {
      ref: icon,
      color:
        theme.colorScheme === "dark"
          ? theme.colors.dark[2]
          : theme.colors.gray[6],
      marginRight: theme.spacing.sm,
    },

    linkActive: {
      "&, &:hover": {
        backgroundColor: theme.fn.variant({
          variant: "light",
          color: theme.primaryColor,
        }).background,
        color: theme.fn.variant({ variant: "light", color: theme.primaryColor })
          .color,
        [`& .${icon}`]: {
          color: theme.fn.variant({
            variant: "light",
            color: theme.primaryColor,
          }).color,
        },
      },
    },
  };
});
