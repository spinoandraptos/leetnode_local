import axios from "axios";
import Link from "next/link";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Dots from "@/components/misc/Dots";
import Navbar from "@/components/Navbar";
import { Carousel } from "@mantine/carousel";
import {
  Badge,
  Box,
  Card,
  Center,
  Container,
  createStyles,
  Group,
  Loader,
  Text,
  Title,
} from "@mantine/core";
import { Course, CourseMedia, CourseType, Level, Topic } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

export type CourseWithMediaAndTopicType = Course & {
  courseMedia: CourseMedia[];
  topics: Topic[];
};

export default function CoursesPage() {
  const { classes, theme } = useStyles();

  function BadgeCard({
    slug,
    image,
    title,
    description,
    category,
    badges,
  }: {
    slug: string;
    image: string;
    title: string;
    category: string;
    description: string;
    badges: string[];
  }) {
    const features = badges.map((badge) => (
      <Badge
        color="gray"
        key={badge}
        leftSection="#"
        size="sm"
        variant="filled"
      >
        {badge}
      </Badge>
    ));

    return (
      <Card withBorder radius="md" m="md" p={0} className={classes.card}>
        <Link
          href={slug === "welcome-quiz" ? `/quiz?courseSlug=welcome-quiz` : `/courses/${slug}`}
          passHref
          className={`${
            theme.colorScheme === "dark" ? "text-white" : "text-black"
          }`}
        >
          <Card.Section>
            <Box
              sx={{
                backgroundImage: `url(${image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                height: 200,
              }}
            >
              <Badge size="sm" className="absolute top-3 right-3">
                {category}
              </Badge>
            </Box>
          </Card.Section>
          <Card.Section className={classes.section} mt="md">
            <Text size="lg" weight={500}>
              {title}
            </Text>
            <Text size="sm" mt="xs">
              {description}
            </Text>
          </Card.Section>
          <Card.Section className={classes.section}>
            <Text mt="md" className={classes.label} color="dimmed">
              Topics
            </Text>
            <Group spacing={7} mt={5}>
              {features}
            </Group>
          </Card.Section>
        </Link>
      </Card>
    );
  }

  function CarouselWrapper({ children }: { children: React.ReactNode }) {
    return (
      <Carousel
        slideSize="40%"
        breakpoints={[
          { maxWidth: "md", slideSize: "50%", slideGap: "sm" },
          { maxWidth: "sm", slideSize: "100%" },
        ]}
        align="start"
        slideGap="md"
        controlsOffset={-20}
        controlSize={30}
        height="100%"
        sx={{ flex: 1 }}
        pb="xl"
        withIndicators
        classNames={classes}
      >
        {children}
      </Carousel>
    );
  }

  const { data: courses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () =>
      axios.get<CourseWithMediaAndTopicType[]>("/api/course"),
  });

  if (!courses) {
    return (
      <Center className="h-screen">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Header title="All Courses" />
      <Navbar />
      <Container size={1400} className={classes.wrapper}>
        <Dots
          dotPositions={[
            { left: 0, top: 0 },
            { left: 120, top: 20 },
            { right: 20, top: 60 },
            { right: 60, top: 200 },
          ]}
        />
        <Box className={classes.innerWrapper}>
          <Title className={classes.title}>All Courses</Title>
        </Box>
      </Container>
      <Container size={1000} className={classes.coursesContainer}>
        <Title className={classes.subtitle}>Quizzes</Title>
        <Text color="dimmed" size="xl" mb="xl">
          Quizzes in LeetNode are designed to test your knowledge on a set of
          topics. Unlike practice questions, which are found in the individual
          courses and are recommended to you based on your mastery in a
          particular topic, quizzes will give you a clearer picture of your
          ability to tackle examinations.
        </Text>
        <CarouselWrapper>
          {courses.data
            .filter((course) => course.type === CourseType.Quiz)
            .map((course) => (
              <Carousel.Slide key={course.courseSlug}>
                <BadgeCard
                  {...{
                    slug: course.courseSlug,
                    image: course.courseImage,
                    title: course.courseName,
                    category: `QUIZ`,
                    description: course.courseDescription.replace(
                      /<\/?[^>]+(>|$)/g,
                      ""
                    ),
                    badges: course.topics.map((topic) => topic.topicSlug),
                  }}
                />
              </Carousel.Slide>
            ))}
        </CarouselWrapper>
      </Container>
      <Container size={1000} className={classes.coursesContainer}>
        <Title className={classes.subtitle}>Foundational Courses</Title>
        <Text color="dimmed" size="xl" mb="xl">
          Foundational courses are the building blocks of electrical and
          computer engineering. These touch upon topics that are the bedrock of
          your electrical and computer engineering knowledge and are the most
          important to master.
        </Text>
        <CarouselWrapper>
          {courses.data
            .filter(
              (course) =>
                course.courseLevel === Level.Foundational &&
                course.type === CourseType.Content
            )
            .map((course) => (
              <Carousel.Slide key={course.courseSlug}>
                <BadgeCard
                  {...{
                    slug: course.courseSlug,
                    image: course.courseImage,
                    title: course.courseName,
                    category: `W${course.week}S${course.studio}`,
                    description: course.courseDescription.replace(
                      /<\/?[^>]+(>|$)/g,
                      ""
                    ),
                    badges: course.topics.map((topic) => topic.topicSlug),
                  }}
                />
              </Carousel.Slide>
            ))}
        </CarouselWrapper>
      </Container>
      <Container size={1000} className={classes.coursesContainer}>
        <Title className={classes.subtitle}>Intermediate Courses</Title>
        <Text color="dimmed" size="xl" mb="xl">
          Intermediate courses will teach you the next level of electrical and
          computer engineering. These topics build upon the foundational topics
          and are the next step in your journey.
        </Text>
        <CarouselWrapper>
          {courses.data
            .filter(
              (course) =>
                course.courseLevel === Level.Intermediate &&
                course.type === CourseType.Content
            )
            .map((course) => (
              <Carousel.Slide key={course.courseSlug}>
                <BadgeCard
                  {...{
                    slug: course.courseSlug,
                    image: course.courseImage,
                    title: course.courseName,
                    category: `W${course.week}S${course.studio}`,
                    description: course.courseDescription.replace(
                      /<\/?[^>]+(>|$)/g,
                      ""
                    ),
                    badges: course.topics.map((topic) => topic.topicSlug),
                  }}
                />
              </Carousel.Slide>
            ))}
        </CarouselWrapper>
      </Container>
      <Container size={1000} className={classes.coursesContainer}>
        <Title className={classes.subtitle}>Advanced Courses</Title>
        <Text color="dimmed" size="xl" mb="xl">
          Advanced courses will guide you in the higher level concepts in
          electrical and computer engineering. These contain topics that require
          a deep understanding of both the foundational and intermediate topics
          and will challenge you to the fullest extent.
        </Text>
        <CarouselWrapper>
          {courses.data
            .filter(
              (course) =>
                course.courseLevel === Level.Advanced &&
                course.type === CourseType.Content
            )
            .map((course) => (
              <Carousel.Slide key={course.courseSlug}>
                <BadgeCard
                  {...{
                    slug: course.courseSlug,
                    image: course.courseImage,
                    title: course.courseName,
                    category: `W${course.week}S${course.studio}`,
                    description: course.courseDescription.replace(
                      /<\/?[^>]+(>|$)/g,
                      ""
                    ),
                    badges: course.topics.map((topic) => topic.topicSlug),
                  }}
                />
              </Carousel.Slide>
            ))}
        </CarouselWrapper>
      </Container>
      <Footer />
    </>
  );
}

const useStyles = createStyles((theme, _params, getRef) => ({
  wrapper: {
    position: "relative",
    paddingTop: 40,
    paddingBottom: 40,
    margin: `${theme.spacing.xl}px auto`,

    "@media (max-width: 755px)": {
      paddingTop: 40,
      paddingBottom: 30,
    },
  },

  innerWrapper: {
    position: "relative",
    zIndex: 1,
  },

  coursesContainer: {
    padding: `${theme.spacing.xl}px`,
    margin: "50px auto",
  },

  title: {
    textAlign: "center",
    fontWeight: 800,
    fontSize: 48,
    letterSpacing: -1,
    color: theme.colorScheme === "dark" ? theme.white : theme.black,
    marginBottom: theme.spacing.xs,
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    padding: `${theme.spacing.md}px`,

    "@media (max-width: 520px)": {
      fontSize: 28,
      textAlign: "left",
    },
  },

  subtitle: {
    textAlign: "left",
    fontWeight: 500,
    fontSize: 40,
    letterSpacing: -2,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[0]
        : theme.colors.gray[9],
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    marginBottom: theme.spacing.xl,

    "@media (max-width: 520px)": {
      fontSize: 20,
    },
  },

  cardTitle: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    fontWeight: 900,
    color: theme.white,
    lineHeight: 1.2,
    fontSize: 32,
    marginTop: theme.spacing.xs,
  },

  card: {
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.colors.dark[6]
        : theme.colors.gray[0],
    transition: "all 300ms ease-in-out",
    filter:
      "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06))",

    "&:hover": {
      filter:
        "drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgb(0 0 0 / 0.1))",
    },
  },

  section: {
    borderBottom: `1px solid ${
      theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[3]
    }`,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },

  label: {
    textTransform: "uppercase",
    fontSize: theme.fontSizes.xs,
    fontWeight: 700,
  },

  controls: {
    ref: getRef("controls"),
    transition: "opacity 300ms ease",
    opacity: 0,
  },

  root: {
    "&:hover": {
      [`& .${getRef("controls")}`]: {
        opacity: 1,
      },
    },
  },

  control: {
    border: 0,
    backgroundColor: theme.colors.gray[5],
    "&[data-inactive]": {
      opacity: 0,
      cursor: "default",
    },
  },

  indicator: {
    backgroundColor: theme.colors.gray[5],
    width: 12,
    height: 8,
    transition: "width 250ms ease",

    "&[data-active]": {
      width: 40,
    },
  },
}));
