import axios from "axios";
import { GetStaticProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import QuizQuestion from "@/components/course/QuizQuestion";
import PracticeQuestion from "@/components/course/PracticeQuestion";
import QuestionHistory from "@/components/course/QuestionHistory";
import ResultsPage from "@/components/course/ResultsPage";
import LeetNodeFooter from "@/components/Footer";
import LeetNodeHeader from "@/components/Header";
import LeetNodeNavbar from "@/components/Navbar";
import { getCourseDetails } from "@/pages/api/course/[courseSlug]";
import {
  AppShell, Box, Center, Container, createStyles, Divider,
  Header, Loader, Navbar as Sidebar, ScrollArea, Text, } from "@mantine/core";
import {
  useMediaQuery, useSessionStorage} from "@mantine/hooks";
import { Course, CourseMedia, Mastery, Topic, CourseVideo } from "@prisma/client";
import {
  IconChartLine, IconTarget, IconArrowBarLeft, IconZoomQuestion,
} from "@tabler/icons";
import { useQuery } from "@tanstack/react-query";

export type CourseInfoType = {
  topics: (Topic & {
    mastery: Mastery[];
  })[];
} | null;

export type UserQuestionWithAttemptsType = {
  topics: (Topic & {
    mastery: Mastery[];
  })[];
} | null;

export default function CourseMainPage({
  courseDetails,
}: {
  courseDetails: Course & { courseMedia: CourseMedia[] } & { courseVideo: CourseVideo[]};
}) {
  const { theme, classes, cx } = useStyles();
  const mobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm}px)`);
  const [sidebarOpened, setSidebarOpened] = useState(false);
  useMemo(() => {
    if (mobile !== undefined) {
      setSidebarOpened(!mobile);
    }
  }, [mobile]);

  const [active, setActive] = useSessionStorage({
    key: "courseActiveTab",
    defaultValue: "Attempts",
  });

  const router = useRouter();
  const courseSlug = router.query.courseSlug;

  const { data: course } = useQuery({
    queryKey: ["course", courseSlug],
    queryFn: () =>
      axios.get<CourseInfoType>(`/api/course/${courseSlug}`),
  });

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

  if (!course) {
    return (
      <Center className="h-[calc(100vh-180px)]">
        <Loader />
      </Center>
    );
  }

  const tabs = {
    practice: [
      { label: "Attempts", icon: IconChartLine },
      { label: "Mastery", icon: IconTarget },
    ],
  };

  const links = tabs["practice"].map(
    (item) =>
      item && (
        <a
          className={cx(classes.link, {
            [classes.linkActive]: item.label === active,
          })}
          key={item.label}
          onClick={(event: { preventDefault: () => void }) => {
            event.preventDefault();
            setActive(item.label);
            mobile && setSidebarOpened(false);
          }}
        >
          <item.icon className={classes.linkIcon} stroke={1.5} />
          <span>{item.label}</span>
        </a>
      )
  );

  if (user?.data.isNewUser) {
    return (
      <QuizQuestion />
    )
  }
  else return (
    <AppShell
      className={classes.appshell}
      navbarOffsetBreakpoint="sm"
      header={
        <>
          <LeetNodeHeader title={courseDetails.courseName} />
          <Header height={80}>
            <Container
              style={{ display: "flex", alignItems: "center", height: "100%" }}
            >
              <LeetNodeNavbar
                sidebarOpened={sidebarOpened}
                setSidebarOpened={setSidebarOpened}
              />
            </Container>
          </Header>
        </>
      }
      footer={<LeetNodeFooter />}
      navbar={
        sidebarOpened ? (
          <Sidebar
            p="md"
            width={{ sm: 200, lg: 300 }}
            className={classes.navbar}
          >
            <Sidebar.Section>
              <Text weight={600} size="lg" align="center" mb="lg">
                {courseDetails.courseName}
              </Text>
            </Sidebar.Section>

            <Sidebar.Section mt="xl" grow>
              {links}
              <Divider my="sm" variant="dotted" />
              <Link href="/courses" passHref>
                <Box className={classes.link}>
                  <IconArrowBarLeft className={classes.linkIcon} stroke={1.5} />
                  <span>Back to Courses</span>
                </Box>
              </Link>
            </Sidebar.Section>
          </Sidebar>
        ) : (
          <></>
        )
      }
    >
      <ScrollArea>
        { active === "Attempts" ? (
          <QuestionHistory courseSlug={courseDetails.courseSlug} />
        ) : active === "Mastery" ? (
          <ResultsPage />
        ) : (
          <Text>Error</Text>
        )}
      </ScrollArea>
    </AppShell>
  );
}

export const getStaticProps: GetStaticProps = async (context) => {
  const courseDetails = await getCourseDetails("welcome-quiz" as string);

  console.log(
    typeof courseDetails === "object"
      ? `PRERENDERED /welcome-quiz DETAILS`
      : "FAILED TO PRERENDER"
  );

  return {
    props: {
      courseDetails,
    },
  };
};

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
