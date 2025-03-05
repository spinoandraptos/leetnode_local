import axios from "axios";
import dynamic from "next/dynamic";
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { z } from "zod";

import { CourseNamesType } from "@/components/course/CourseDiscussion";
import Latex from "@/components/Latex";
import { CourseTypeBadge } from "@/components/misc/Badges";
import { AllQuestionsType, QuestionFormFullType } from "@/types/question-types";
import { CustomEval } from "@/utils/CustomEval";
import { CustomMath } from "@/utils/CustomMath";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  ActionIcon,
  Affix,
  Badge,
  Box,
  Button,
  Center,
  Code,
  createStyles,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { randomId, useMediaQuery } from "@mantine/hooks";
import { Prism } from "@mantine/prism";
import {
  CourseType,
  Level,
  Question,
  QuestionDifficulty,
  Topic,
} from "@prisma/client";
import {
  IconBulb,
  IconCheck,
  IconChecks,
  IconCircleX,
  IconCode,
  IconDice3,
  IconEraser,
  IconGripVertical,
  IconHelp,
  IconMathFunction,
  IconMountain,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

const Editor = dynamic(import("@/components/editor/CustomRichTextEditor"), {
  ssr: false,
  loading: () => <p>Loading Editor...</p>,
});

export default function QuestionEditor({
  setQuestionAddOpened,
  setQuestionEditOpened,
  editorHtml,
  currQuestionId,
  currVariationId,
  initialValues,
}: {
  setQuestionAddOpened: Dispatch<SetStateAction<boolean>>;
  setQuestionEditOpened: Dispatch<SetStateAction<boolean>>;
  editorHtml: MutableRefObject<string>;
  currQuestionId?: number;
  currVariationId?: number;
  initialValues: QuestionFormFullType;
}) {
  const [questionType, setQuestionType] = useState<"dynamic" | "static">(
    initialValues.variationId === 0 ? "dynamic" : "static"
  );
  const { theme } = useStyles();
  const mobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm}px)`);

  const [rawDataOpened, setRawDataOpened] = useState(false);
  const [filteredCourses, setFilteredCourses] = useState<CourseNamesType[]>([]);
  const [confirmDeleteOpened, setConfirmDeleteOpened] = useState(false);

  const [{ data: questions }, { data: courses }, { data: topics }] = useQueries(
    {
      queries: [
        {
          queryKey: ["all-questions"],
          queryFn: () => axios.get<AllQuestionsType>("/api/question/admin"),
        },
        {
          queryKey: ["all-course-names"],
          queryFn: () =>
            axios.get<CourseNamesType[]>("/api/forum/getAllCourseNames"),
        },
        {
          queryKey: ["all-topic-names"],
          queryFn: () => axios.get<Topic[]>("/api/forum/getAllTopicNames"),
        },
      ],
    }
  );

  const titles = useMemo(() => {
    const titles = new Set(questions?.data.map((q) => q.questionTitle));
    return [...titles];
  }, [questions?.data]);

  const form = useForm({
    initialValues: initialValues,
    validateInputOnBlur: true,
    validate: zodResolver(
      z.object({
        title: z
          .string()
          .trim()
          .min(5, { message: "Title is too short" })
          .max(150, { message: "Title is too long" })
          .refine(
            (title) =>
              !titles
                .filter((t) =>
                  currQuestionId
                    ? t !==
                      questions?.data.find(
                        (q) => q.questionId === currQuestionId
                      )?.questionTitle
                    : t
                )
                .includes(title),
            {
              message: "Title already exists",
            }
          ),
        topic: z.string().min(1, { message: "Please pick a topic" }),
        difficulty: z.nativeEnum(QuestionDifficulty, {
          errorMap: () => ({ message: "Please pick a difficulty" }),
        }),
        variables: z
          .array(
            z.object({
              name: z
                .string()
                .trim()
                .regex(/^(?![^=$]*[=$]).*$/, {
                  message: "Equal and dollar signs not allowed",
                })
                .min(1, { message: "Cannot be empty" }),
              randomize: z.boolean(),
              isFinalAnswer: z.boolean(),
              unit: z.string().optional(),
              default: z
                .string()
                .regex(/^(?![^=$]*[=$]).*$/, {
                  message: "Equal and dollar signs not allowed",
                })
                .optional(),
              min: z.number().optional(),
              max: z.number().optional(),
              decimalPlaces: z.number().int().min(0).max(10).optional(),
              step: z.number().optional(),
            })
          )
          .nonempty({ message: "Please add at least 1 variable" })
          .or(z.literal(undefined)),
        methods: z
          .array(
            z.object({
              expr: z
                .string()
                .trim()
                .regex(/^[^=]+=[^=]+$/, { message: "Invalid expression" })
                .min(1, { message: "Cannot be empty" }),
              explanation: z
                .string()
                .min(10, {
                  message:
                    "Please provide an explanation if you have toggled Add Explanation",
                })
                .optional()
                .or(z.literal(undefined)),
            })
          )
          .nonempty({ message: "Please add at least 1 method" })
          .or(z.literal(undefined)),
        answers: z
          .array(
            z.object({
              answerContent: z
                .string()
                .min(1, { message: "Cannot be empty" })
                .max(500, { message: "Answer is too long" }),
              isCorrect: z.boolean(),
            })
          )
          .min(2, {
            message:
              "Please add at least 2 possible options for static questions",
          })
          .refine(
            (answers) => {
              const correctAnswers = answers.filter(
                (answer) => answer.isCorrect
              );
              return correctAnswers.length >= 1;
            },
            { message: "Please have at least 1 correct answer" }
          )
          .or(z.literal(undefined)),
      })
    ),
  });

  const previewMessage = "\\text{Refresh to View Variables}";
  const previewFinalAnsMessage = "\\text{Refresh to View Final Answers}";
  const [preview, setPreview] = useState(previewMessage);
  const [finalAnsPreview, setFinalAnsPreview] = useState(
    previewFinalAnsMessage
  );

  const invalidMessage = "\\text{Invalid Variables or Methods}";
  const handlePreviewChange = (toRandomize: boolean) => {
    form.clearErrors();
    form.validate();

    // Trim whitespaces from start/end of variable names
    form.values.variables?.map((variable) => {
      variable.name = variable.name.trim();
    });

    // If static question, skip evaluation and return early
    if (questionType === "static") {
      if (!form.values.variables || form.values.variables.length == 0) {
        setPreview("\\text{No variables specified}");
        toast(
          "No variables specified. Just make sure they are part of the question content when you are building static questions.",
          {
            duration: 5000,
            className: "border border-solid border-amber-500",
            icon: "⚠️",
          }
        );
      } else {
        setPreview(
          form.values.variables
            .filter((item) => !item.isFinalAnswer)
            .map((item) => {
              return `${item.name} ${
                item.unit ? "~(" + item.unit + ")" : ""
              } &= ${item.default}`;
            })
            .join("\\\\")
        );
        toast.success("Preview Updated!");
      }
      return;
    }

    try {
      const { questionVariables, editorAnswers } = CustomEval(
        form.values.variables,
        form.values.methods,
        toRandomize
      );

      setPreview(
        questionVariables
          .map((item) => {
            return `${item.name} ${
              item.unit ? "~(" + item.unit + ")" : ""
            } &= ${item.default}`;
          })
          .join("\\\\")
      );

      setFinalAnsPreview(
        editorAnswers
          .map((item) => {
            return `${item.name} ${
              item.unit ? "~(" + item.unit + ")" : ""
            } &= ${item.answerContent} ~|~ ${item.incorrectAnswers
              .map((ans) => ans.answerContent)
              .join("~|~")}`;
          })
          .join("\\\\")
      );
    } catch (e) {
      console.error(e);
      setPreview(invalidMessage);
      setFinalAnsPreview(invalidMessage);
      if (e instanceof Error && e.cause === "invalid-methods") {
        const error = JSON.parse(e.message) as {
          message: string;
          index: number;
          expr: string;
          sanitized: string;
          encoded: string;
        };
        toast(
          (t) => (
            <Stack ml="md" className="w-full max-w-max">
              <Flex gap="sm">
                <IconCircleX
                  color="white"
                  fill="red"
                  size={40}
                  className="self-center"
                />
                <Text fw={600} fz="sm">
                  Error: {error.message}
                </Text>
                <ActionIcon ml="auto" onClick={() => toast.dismiss(t.id)}>
                  <IconX size={18} />
                </ActionIcon>
              </Flex>
              <Text fz="sm">
                Check or reorder{" "}
                <Text underline span>
                  method #{error.index}
                </Text>
              </Text>
              <Code>{error.expr}</Code>
              <Text fz="sm">Sanitized:</Text>
              <Code>{error.sanitized}</Code>
              <Text fz="sm">Encoded:</Text>
              <Code>{error.encoded}</Code>
            </Stack>
          ),
          {
            duration: 10000,
            className: "border border-solid border-red-500",
          }
        );
      } else {
        toast.error(e instanceof Error ? e.message : "Unknown Error", {
          duration: 5000,
          className: "border border-solid border-red-500",
        });
      }
      return;
    }

    if (toRandomize) {
      toast("Randomized!", {
        icon: "🎲",
        duration: 700,
      });
    } else {
      toast.success("Preview Updated!");
    }
  };

  const varFields = form.values.variables?.map((item, index) => (
    <Draggable key={item.key} index={index} draggableId={item.key}>
      {(provided) => (
        <Stack
          p="md"
          pr={"2.5rem"}
          my="md"
          className={`relative ${
            theme.colorScheme === "dark"
              ? "rounded-md odd:bg-gray-600 even:bg-gray-700"
              : "rounded-md odd:bg-gray-100 even:bg-gray-200"
          }`}
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <ActionIcon
            className="absolute right-1.5 top-1/3"
            variant="transparent"
            onClick={() => form.removeListItem("variables", index)}
          >
            <IconTrash size={mobile ? 12 : 16} />
          </ActionIcon>
          <Flex gap="sm" align="center" wrap="wrap">
            <ActionIcon variant="transparent" {...provided.dragHandleProps}>
              <IconGripVertical size={mobile ? 14 : 18} />
            </ActionIcon>
            <Stack align="center" spacing="xs" ml={-10}>
              <Tooltip label="Set Final Answer" withArrow>
                <ActionIcon
                  size={mobile ? "xs" : "md"}
                  variant="default"
                  radius="xl"
                  className={
                    item.isFinalAnswer ? "border border-red-600 bg-red-50" : ""
                  }
                  disabled={item.randomize}
                  onClick={() => {
                    form.setFieldValue(`variables.${index}.randomize`, false);
                    form.setFieldValue(`variables.${index}.default`, undefined);
                    form.setFieldValue(
                      `variables.${index}.min`,
                      item.isFinalAnswer ? undefined : -90
                    );
                    form.setFieldValue(
                      `variables.${index}.max`,
                      item.isFinalAnswer ? undefined : 90
                    );
                    form.setFieldValue(
                      `variables.${index}.step`,
                      item.isFinalAnswer ? undefined : 20
                    );
                    form.setFieldValue(
                      `variables.${index}.isFinalAnswer`,
                      !item.isFinalAnswer
                    );
                    form.setFieldValue(
                      `variables.${index}.decimalPlaces`,
                      item.isFinalAnswer ? undefined : 3
                    );
                  }}
                >
                  <IconChecks
                    size={mobile ? 12 : 16}
                    className={item.isFinalAnswer ? "stroke-red-600" : ""}
                  />
                </ActionIcon>
              </Tooltip>
              {questionType === "dynamic" && (
                <Tooltip label="Randomize" withArrow>
                  <ActionIcon
                    size={mobile ? "xs" : "md"}
                    variant="default"
                    radius="xl"
                    disabled={item.isFinalAnswer}
                    className={
                      item.randomize
                        ? "border border-fuchsia-600 bg-fuchsia-50"
                        : ""
                    }
                    onClick={() => {
                      form.setFieldValue(
                        `variables.${index}.randomize`,
                        !item.randomize
                      );
                    }}
                  >
                    <IconDice3
                      size={mobile ? 12 : 16}
                      className={item.randomize ? "stroke-fuchsia-600" : ""}
                    />
                  </ActionIcon>
                </Tooltip>
              )}
            </Stack>
            <TextInput
              label="Name"
              required
              miw="15%"
              sx={{ flex: 1 }}
              size={mobile ? "xs" : "sm"}
              {...form.getInputProps(`variables.${index}.name`)}
            />
            <TextInput
              label="Unit"
              miw="15%"
              sx={{ flex: 1 }}
              size={mobile ? "xs" : "sm"}
              {...form.getInputProps(`variables.${index}.unit`)}
            />
            {form.values.variables &&
              (!form.values.variables[index]?.isFinalAnswer ? (
                <TextInput
                  label="Default"
                  miw="15%"
                  sx={{ flex: 1 }}
                  size={mobile ? "xs" : "sm"}
                  required={!form.values.variables[index]?.isFinalAnswer}
                  {...form.getInputProps(`variables.${index}.default`)}
                />
              ) : (
                questionType === "dynamic" && (
                  <NumberInput
                    label={mobile ? "DP" : "Decimal Places"}
                    miw="15%"
                    sx={{ flex: 1 }}
                    size={mobile ? "xs" : "sm"}
                    required={form.values.variables[index]?.isFinalAnswer}
                    {...form.getInputProps(`variables.${index}.decimalPlaces`)}
                  />
                )
              ))}
            <Box
              mih="2rem"
              sx={{ flex: 3, alignSelf: "stretch" }}
              className={`flex items-center justify-center rounded-md border border-solid p-1 ${
                theme.colorScheme === "dark"
                  ? "border-slate-800 bg-slate-800"
                  : "border-slate-300 bg-slate-200"
              }`}
            >
              <Latex>{`$$ ${item.name ?? ""}${
                item.unit ? "~(" + item.unit + ")" : ""
              }${
                item.default !== undefined ? "=" + item.default : ""
              }$$`}</Latex>
            </Box>
          </Flex>
          {form.values.variables && item.randomize && !item.isFinalAnswer && (
            <Flex gap="sm" align="center">
              {!mobile && (
                <Text fw={500} fz={mobile ? "xs" : "sm"}>
                  Min <span className="text-red-500">*</span>
                </Text>
              )}
              <NumberInput
                label={mobile ? "Min" : ""}
                size="xs"
                sx={{ flex: 1 }}
                required={item.randomize}
                precision={CustomMath.getDecimalPlaces(
                  form.values.variables[index]?.min ?? 0
                )}
                hideControls
                {...form.getInputProps(`variables.${index}.min`)}
              />
              {!mobile && (
                <Text fw={500} fz={mobile ? "xs" : "sm"}>
                  Max <span className="text-red-500">*</span>
                </Text>
              )}
              <NumberInput
                label={mobile ? "Max" : ""}
                size="xs"
                sx={{ flex: 1 }}
                required={item.randomize}
                precision={CustomMath.getDecimalPlaces(
                  form.values.variables[index]?.max ?? 0
                )}
                hideControls
                {...form.getInputProps(`variables.${index}.max`)}
              />
              {!mobile && (
                <Text fw={500} fz={mobile ? "xs" : "sm"}>
                  Decimal Places <span className="text-red-500">*</span>
                </Text>
              )}
              <NumberInput
                label={mobile ? "DP" : ""}
                size="xs"
                sx={{ flex: 1 }}
                required={item.randomize}
                {...form.getInputProps(`variables.${index}.decimalPlaces`)}
              />
            </Flex>
          )}
          {form.values.variables &&
            item.isFinalAnswer &&
            questionType === "dynamic" && (
              <Flex gap="sm" align="center">
                {!mobile && (
                  <Text fw={500} fz="sm">
                    Min % <span className="text-red-500">*</span>
                  </Text>
                )}
                <NumberInput
                  label={mobile ? "Min %" : ""}
                  size="xs"
                  sx={{ flex: 1 }}
                  required={item.isFinalAnswer}
                  precision={CustomMath.getDecimalPlaces(
                    form.values.variables[index]?.min ?? 0
                  )}
                  hideControls
                  placeholder="-90"
                  {...form.getInputProps(`variables.${index}.min`)}
                />
                {!mobile && (
                  <Text fw={500} fz="sm">
                    Max % <span className="text-red-500">*</span>
                  </Text>
                )}
                <NumberInput
                  label={mobile ? "Max %" : ""}
                  size="xs"
                  sx={{ flex: 1 }}
                  required={item.isFinalAnswer}
                  precision={CustomMath.getDecimalPlaces(
                    form.values.variables[index]?.max ?? 0
                  )}
                  hideControls
                  placeholder="90"
                  {...form.getInputProps(`variables.${index}.max`)}
                />
                {!mobile && (
                  <Text fw={500} fz="sm">
                    % Step Size <span className="text-red-500">*</span>
                  </Text>
                )}
                <NumberInput
                  label={mobile ? "% Step Size" : ""}
                  size="xs"
                  sx={{ flex: 1 }}
                  required={item.isFinalAnswer}
                  precision={CustomMath.getDecimalPlaces(
                    form.values.variables[index]?.step ?? 0
                  )}
                  hideControls
                  placeholder="20"
                  {...form.getInputProps(`variables.${index}.step`)}
                />
              </Flex>
            )}
        </Stack>
      )}
    </Draggable>
  ));

  const newVar = () => {
    form.values.variables = form.values.variables ?? [];
    form.insertListItem("variables", {
      key: randomId(),
      encoded: CustomMath.randomString(),
      randomize: false,
      isFinalAnswer: false,
      name: "",
    });
  };

  const methodFields = form.values.methods?.map((item, index) => (
    <Draggable key={item.key} index={index} draggableId={item.key}>
      {(provided) => (
        <Stack
          p="md"
          my="md"
          className={
            theme.colorScheme === "dark"
              ? "rounded-md odd:bg-gray-600 even:bg-gray-700"
              : "rounded-md odd:bg-gray-100 even:bg-gray-200"
          }
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <Flex gap="sm" align="center" wrap="wrap">
            <ActionIcon variant="transparent" {...provided.dragHandleProps}>
              <IconGripVertical size={mobile ? 14 : 18} />
            </ActionIcon>
            <Text color="dimmed" fz={mobile ? "xs" : "md"}>
              #{index + 1}
            </Text>
            <TextInput
              miw="10rem"
              sx={{ flex: 1 }}
              {...form.getInputProps(`methods.${index}.expr`)}
            />
            <Box
              miw="10rem"
              mih="2rem"
              sx={{ flex: 1, alignSelf: "stretch" }}
              className={`flex items-center justify-center rounded-md border border-solid p-1 ${
                theme.colorScheme === "dark"
                  ? "border-slate-800 bg-slate-800"
                  : "border-slate-300 bg-slate-200"
              }`}
            >
              <Latex>{`$$ ${item.expr} $$`}</Latex>
            </Box>
            <Tooltip label="Add Explanation" withArrow>
              <ActionIcon
                size={mobile ? "xs" : "md"}
                variant="default"
                radius="xl"
                className={
                  item.explanation !== undefined
                    ? "border border-amber-600 bg-amber-50"
                    : ""
                }
                onClick={() => {
                  form.setFieldValue(
                    `methods.${index}.explanation`,
                    item.explanation === undefined ? "" : undefined
                  );
                }}
              >
                <IconBulb
                  size={mobile ? 12 : 16}
                  className={
                    item.explanation !== undefined ? "stroke-yellow-600" : ""
                  }
                />
              </ActionIcon>
            </Tooltip>
            <ActionIcon
              size={mobile ? "xs" : "md"}
              variant="transparent"
              onClick={() => form.removeListItem("methods", index)}
            >
              <IconTrash size={mobile ? 12 : 16} />
            </ActionIcon>
          </Flex>
          {item.explanation !== undefined && (
            <Flex gap="sm" align="center">
              <Text fw={500} fz={mobile ? "xs" : "sm"}>
                Explanation <span className="text-red-500">*</span>
              </Text>
              <Textarea
                sx={{ flex: 1 }}
                required={item.explanation !== undefined}
                {...form.getInputProps(`methods.${index}.explanation`)}
              />
            </Flex>
          )}
        </Stack>
      )}
    </Draggable>
  ));

  const newMethod = () => {
    form.values.methods = form.values.methods ?? [];
    form.insertListItem("methods", {
      key: randomId(),
      expr: "",
    });
  };

  const hintFields = form.values.hints?.map((item, index) => (
    <Draggable key={item.key} index={index} draggableId={item.key}>
      {(provided) => (
        <Flex
          gap="sm"
          align="center"
          p="md"
          my="md"
          wrap="wrap"
          className={
            theme.colorScheme === "dark"
              ? "rounded-md odd:bg-gray-600 even:bg-gray-700"
              : "rounded-md odd:bg-gray-100 even:bg-gray-200"
          }
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <ActionIcon variant="transparent" {...provided.dragHandleProps}>
            <IconGripVertical size={mobile ? 14 : 18} />
          </ActionIcon>
          <Text color="dimmed" fz={mobile ? "xs" : "md"}>
            #{index + 1}
          </Text>
          <Textarea
            sx={{ flex: 1 }}
            required
            {...form.getInputProps(`hints.${index}.hint`)}
          />
          <ActionIcon
            variant="transparent"
            onClick={() => form.removeListItem("hints", index)}
          >
            <IconTrash size={mobile ? 12 : 16} />
          </ActionIcon>
        </Flex>
      )}
    </Draggable>
  ));

  const newHint = () => {
    form.values.hints = form.values.hints ?? [];
    form.insertListItem("hints", {
      key: randomId(),
      hint: "",
    });
  };

  const answerFields = form.values.answers?.map((item, index) => (
    <Draggable key={item.key} index={index} draggableId={item.key}>
      {(provided) => (
        <Flex
          gap="sm"
          align="center"
          p="md"
          my="md"
          wrap="wrap"
          className={
            theme.colorScheme === "dark"
              ? "rounded-md odd:bg-gray-600 even:bg-gray-700"
              : "rounded-md odd:bg-gray-100 even:bg-gray-200"
          }
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <ActionIcon variant="transparent" {...provided.dragHandleProps}>
            <IconGripVertical size={mobile ? 14 : 18} />
          </ActionIcon>
          <Stack align="center" spacing="xs" ml={-10}>
            <Tooltip label="Set Correct Answer" withArrow>
              <ActionIcon
                size={mobile ? "xs" : "md"}
                variant="default"
                radius="xl"
                className={
                  item.isCorrect
                    ? "border border-green-600 bg-green-50"
                    : "border border-red-600 bg-red-50"
                }
                onClick={() => {
                  form.setFieldValue(
                    `answers.${index}.isCorrect`,
                    !item.isCorrect
                  );
                }}
              >
                {item.isCorrect ? (
                  <IconCheck
                    size={mobile ? 12 : 16}
                    className="stroke-green-600"
                  />
                ) : (
                  <IconX size={mobile ? 12 : 16} className="stroke-red-600" />
                )}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Display as LaTeX" withArrow>
              <ActionIcon
                size={mobile ? "xs" : "md"}
                variant="default"
                radius="xl"
                className={
                  item.isLatex ? "border border-sky-600 bg-sky-50" : ""
                }
                onClick={() => {
                  form.setFieldValue(`answers.${index}.isLatex`, !item.isLatex);
                }}
              >
                <IconMathFunction
                  size={mobile ? 12 : 16}
                  className={item.isLatex ? "stroke-sky-600" : ""}
                />
              </ActionIcon>
            </Tooltip>
          </Stack>
          <Text color="dimmed" fz={mobile ? "xs" : "md"}>
            #{index + 1}
          </Text>
          <Textarea
            miw="10rem"
            sx={{ flex: 1 }}
            required
            {...form.getInputProps(`answers.${index}.answerContent`)}
          />
          <Box
            miw="10rem"
            sx={{ flex: 1, alignSelf: "stretch" }}
            className={`flex items-center justify-center rounded-md border border-solid ${
              theme.colorScheme === "dark"
                ? "border-slate-800 bg-slate-800"
                : "border-slate-300 bg-slate-200"
            } py-4`}
          >
            {item.isLatex ? (
              <Latex>{`$$ ${item.answerContent} $$`}</Latex>
            ) : (
              <Text fz={mobile ? "xs" : "md"}>{item.answerContent}</Text>
            )}
          </Box>
          <ActionIcon
            variant="transparent"
            onClick={() => form.removeListItem("answers", index)}
          >
            <IconTrash size={mobile ? 12 : 16} />
          </ActionIcon>
        </Flex>
      )}
    </Draggable>
  ));

  const newAnswer = () => {
    form.values.answers = form.values.answers ?? [];
    form.insertListItem("answers", {
      key: randomId(),
      answerContent: "",
      isCorrect: false,
      isLatex: false,
    });
  };

  const useCRUDQuestion = () => {
    const queryClient = useQueryClient();
    const { mutate: addQuestion, status: addQuestionStatus } = useMutation({
      mutationFn: (
        newQuestion: Omit<Question, "questionId" | "lastModified"> & {
          baseQuestionId?: string | null;
        }
      ) => axios.post("/api/question/admin/add", newQuestion),
      onSuccess: () => {
        queryClient.invalidateQueries(["all-questions"]);
        setQuestionAddOpened(false);
        setQuestionEditOpened(false);
      },
    });

    const { mutate: editQuestion, status: editQuestionStatus } = useMutation({
      mutationFn: ({
        questionId,
        variationId,
        editedQuestion,
      }: {
        questionId: number;
        variationId: number;
        editedQuestion: Omit<
          Question,
          "questionId" | "variationId" | "lastModified"
        > & { newQuestionId?: string | null; newVariationId?: number | null };
      }) =>
        axios.put(
          `/api/question/admin/edit?questionId=${questionId}&variationId=${variationId}`,
          editedQuestion
        ),
      onSuccess: () => {
        queryClient.invalidateQueries(["all-questions"]);
        setQuestionEditOpened(false);
      },
    });

    const { mutate: deleteQuestion, status: deleteQuestionStatus } =
      useMutation({
        mutationFn: ({
          questionId,
          variationId,
        }: {
          questionId: number;
          variationId: number;
        }) =>
          axios.delete(
            `/api/question/admin/delete?questionId=${questionId}&variationId=${variationId}`
          ),
        onSuccess: () => {
          queryClient.invalidateQueries(["all-questions"]);
        },
      });

    return {
      addQuestion,
      addQuestionStatus,
      editQuestion,
      editQuestionStatus,
      deleteQuestion,
      deleteQuestionStatus,
    };
  };

  const {
    addQuestion,
    addQuestionStatus,
    editQuestion,
    editQuestionStatus,
    deleteQuestion,
    deleteQuestionStatus,
  } = useCRUDQuestion();

  const handleCoursesBadges = (value: string | null) => {
    if (!courses) return;
    setFilteredCourses(
      courses?.data.filter(
        (course: {
          topics: {
            topicSlug: string;
          }[];
        }) => course.topics.some((topic) => topic.topicSlug === value)
      )
    );
  };

  useEffect(() => {
    if (currQuestionId) {
      handleCoursesBadges(initialValues.topic);
    }
  }, [courses]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!questions || !courses || !topics) {
    return (
      <Center className="h-screen">
        <Loader />
      </Center>
    );
  }

  const allTopics = topics.data.map(
    (topic: { topicName: string; topicSlug: string; topicLevel: string }) => {
      return {
        label: topic.topicName,
        value: topic.topicSlug,
        group: topic.topicLevel,
      };
    }
  );

  return (
    <form
      className="pr-5"
      onSubmit={form.onSubmit(
        (values) => {
          if (currQuestionId === undefined || currVariationId === undefined) {
            addQuestion({
              baseQuestionId: values.baseQuestionId,
              variationId: questionType === "dynamic" ? 0 : values.variationId,
              topicSlug: values.topic,
              questionTitle: values.title,
              questionDifficulty:
                values.difficulty ?? QuestionDifficulty.Medium,
              questionContent: editorHtml.current,
              questionData: {
                variables: values.variables,
                methods: values.methods,
                hints: values.hints,
                answers: values.answers,
              },
            });
          } else {
            editQuestion({
              questionId: currQuestionId,
              variationId: currVariationId,
              editedQuestion: {
                newQuestionId: values.baseQuestionId,
                newVariationId:
                  questionType === "dynamic" ? 0 : values.variationId,
                topicSlug: values.topic,
                questionTitle: values.title,
                questionDifficulty:
                  values.difficulty ?? QuestionDifficulty.Medium,
                questionContent: editorHtml.current,
                questionData: {
                  variables: values.variables,
                  methods: values.methods,
                  hints: values.hints,
                  answers: values.answers,
                },
              },
            });
          }
        },
        (errors) => {
          Object.keys(errors).forEach((key) => {
            toast.error(errors[key] as string);
          });
        }
      )}
    >
      <SegmentedControl
        fullWidth
        mb="lg"
        value={questionType}
        onChange={(value: "dynamic" | "static") => {
          setQuestionType(value);
          if (value === "dynamic") {
            form.values.variationId = 0;
            form.values.baseQuestionId = undefined;
          } else {
            form.values.variationId = 1;
            form.values.variables?.map((_item, index) => {
              form.setFieldValue(`variables.${index}.randomize`, false);
              form.setFieldValue(`variables.${index}.min`, undefined);
              form.setFieldValue(`variables.${index}.max`, undefined);
              form.setFieldValue(`variables.${index}.step`, undefined);
              form.setFieldValue(`variables.${index}.decimalPlaces`, undefined);
            });
          }
        }}
        data={[
          {
            label: (
              <Tooltip.Floating
                multiline
                width={290}
                label="
                Dynamic questions are questions that can generate multiple variations of the same question using valid random variables and math expressions.
              "
              >
                <Center>
                  <IconDice3 size={18} />
                  <Box ml={10}>Dynamic Question</Box>
                </Center>
              </Tooltip.Floating>
            ),
            value: "dynamic",
          },
          {
            label: (
              <Tooltip.Floating
                multiline
                width={320}
                label="
                Static questions are questions that require everything to be user-defined. There are no variable and expression checks nor evaluations. The question is displayed as is and correctness must be ensured by the user.
              "
              >
                <Center>
                  <IconMountain size={18} />
                  <Box ml={10}>Static Question</Box>
                </Center>
              </Tooltip.Floating>
            ),
            value: "static",
          },
        ]}
      />

      {questionType === "static" && (
        <SimpleGrid
          mb="lg"
          cols={2}
          breakpoints={[{ maxWidth: "sm", cols: 1 }]}
        >
          <Select
            clearable
            searchable
            placeholder="Leave Empty if this is a Base Question"
            label="Base Question"
            data={questions?.data
              .filter((question) => question.variationId === 1)
              .map((question) => {
                return {
                  label: `[ID#${question.questionId}] ${question.questionTitle}`,
                  value: question.questionId.toString(),
                };
              })}
            value={form.values.baseQuestionId}
            onChange={(value: string | null) => {
              form.setFieldValue("baseQuestionId", value);
              if (!value) {
                form.setFieldValue("variationId", 1);
              } else {
                const variationIds = questions?.data
                  .filter((question) => question.questionId === parseInt(value))
                  .map((question) => question.variationId);

                // Get the smallest id not already used (in case of gaps)
                const unusedVariationId = variationIds?.reduce((acc, curr) => {
                  if (curr > acc && !variationIds.includes(acc)) {
                    return acc;
                  }
                  return curr + 1;
                }, 1);
                form.setFieldValue("variationId", unusedVariationId);
              }
            }}
          />
          <NumberInput
            label="Variation ID"
            disabled
            value={form.values.variationId}
          />
        </SimpleGrid>
      )}

      <TextInput
        label="Title"
        placeholder="Short Title (Must be unique)"
        name="title"
        mb="lg"
        required
        {...form.getInputProps("title")}
      />

      <SimpleGrid cols={2} breakpoints={[{ maxWidth: "sm", cols: 1 }]}>
        <Select
          data={[
            {
              label: "Easy",
              value: QuestionDifficulty.Easy,
            },
            {
              label: "Medium",
              value: QuestionDifficulty.Medium,
            },
            {
              label: "Hard",
              value: QuestionDifficulty.Hard,
            },
          ]}
          placeholder="Select question difficulty"
          label="Difficulty"
          required
          {...form.getInputProps("difficulty")}
        />
        <Select
          data={allTopics}
          value={form.values.topic}
          placeholder="Select key topic tested"
          label="Key Topic"
          required
          onChange={(value) => {
            form.values.topic = value ?? "";
            handleCoursesBadges(value);
            form.errors.topic = undefined;
          }}
          error={form.errors.topic}
        />
      </SimpleGrid>

      <Text weight={500} size="sm" mb="xs" mt="lg">
        Topics in Courses
      </Text>
      <Flex gap="sm" wrap="wrap" mb="lg">
        {filteredCourses && filteredCourses.length > 0 ? (
          filteredCourses.map(
            (course: {
              courseName: string;
              courseLevel: Level;
              type: CourseType;
            }) => <CourseTypeBadge key={course.courseName} course={course} />
          )
        ) : (
          <Badge color="dark">None</Badge>
        )}
      </Flex>

      <Text weight={500} size="sm" mb="xs">
        Question <span className="text-red-500">*</span>
      </Text>
      <Editor
        stickyOffset={-20}
        upload_preset="question_media"
        value={editorHtml.current}
        onChange={(html) => {
          editorHtml.current = html;
        }}
      />

      <Flex mt="xl" align="center">
        <Text weight={500} size="sm">
          Variables <span className="text-red-500">*</span>
        </Text>
        <Tooltip
          multiline
          width={350}
          withArrow
          label="Complex numbers and phasors are currently not supported. Set a variable as a final answer on the right to make it part of the question's options."
        >
          <ActionIcon
            variant="transparent"
            radius="xl"
            ml="lg"
            className="cursor"
            component="a"
            href="https://mathjs.org/docs/expressions/syntax.html#constants-and-variables"
            target="_blank"
          >
            <IconHelp
              size={20}
              color={theme.colorScheme === "dark" ? "white" : "black"}
            />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <DragDropContext
        onDragEnd={({ destination, source }) =>
          form.reorderListItem("variables", {
            from: source.index,
            to: destination?.index ?? source.index,
          })
        }
      >
        <Droppable droppableId="vars-dnd" direction="vertical">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {varFields}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button
        fullWidth
        variant="light"
        color="gray"
        className={theme.colorScheme === "dark" ? "bg-zinc-800" : "bg-gray-100"}
        radius="sm"
        mt="md"
        onClick={newVar}
      >
        <IconPlus size={16} />
      </Button>

      <Flex mt="xl" align="center">
        <Text weight={500} size="sm">
          Methods <span className="text-red-500">*</span>
        </Text>
        <Tooltip
          multiline
          width={360}
          withArrow
          label="Expressions must have 1 and only 1 equal sign in the middle. The result from the left side will be assigned to the variable on the right side. Explanations will only be shown after attempting the question."
        >
          <ActionIcon
            variant="transparent"
            radius="xl"
            ml="lg"
            className="cursor-help"
          >
            <IconHelp
              size={20}
              color={theme.colorScheme === "dark" ? "white" : "black"}
            />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <DragDropContext
        onDragEnd={({ destination, source }) =>
          form.reorderListItem("methods", {
            from: source.index,
            to: destination?.index ?? source.index,
          })
        }
      >
        <Droppable droppableId="methods-dnd" direction="vertical">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {methodFields}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button
        fullWidth
        variant="light"
        color="gray"
        className={theme.colorScheme === "dark" ? "bg-zinc-800" : "bg-gray-100"}
        radius="sm"
        mt="md"
        onClick={newMethod}
      >
        <IconPlus size={16} />
      </Button>

      <Flex mt="xl" align="center">
        <Text weight={500} size="sm">
          Hints
        </Text>
        <Tooltip
          multiline
          width={240}
          withArrow
          label="Hints are optional and can be seen when attempting the question."
        >
          <ActionIcon
            variant="transparent"
            radius="xl"
            ml="lg"
            className="cursor-help"
          >
            <IconHelp
              size={20}
              color={theme.colorScheme === "dark" ? "white" : "black"}
            />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <DragDropContext
        onDragEnd={({ destination, source }) =>
          form.reorderListItem("hints", {
            from: source.index,
            to: destination?.index ?? source.index,
          })
        }
      >
        <Droppable droppableId="hints-dnd" direction="vertical">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {hintFields}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button
        fullWidth
        variant="light"
        color="gray"
        className={theme.colorScheme === "dark" ? "bg-zinc-800" : "bg-gray-100"}
        radius="sm"
        mt="md"
        onClick={newHint}
      >
        <IconPlus size={16} />
      </Button>

      <Flex mt="xl" mb="md" align="center">
        <Text weight={500} size="sm">
          Preview
        </Text>
        <Tooltip label="Refresh" withArrow>
          <ActionIcon
            variant="default"
            radius="xl"
            ml="lg"
            onClick={() => handlePreviewChange(false)}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
        {questionType === "dynamic" && (
          <Tooltip label="Randomize" withArrow>
            <ActionIcon
              variant="default"
              radius="xl"
              ml="sm"
              onClick={() => handlePreviewChange(true)}
            >
              <IconDice3 size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Raw Data" withArrow>
          <ActionIcon
            variant="default"
            radius="xl"
            ml="sm"
            onClick={() => setRawDataOpened(true)}
          >
            <IconCode size={16} />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <Box
        className={`flex items-center justify-center rounded-md border border-solid ${
          theme.colorScheme === "dark"
            ? "border-slate-800 bg-slate-800"
            : "border-slate-300 bg-slate-200"
        } pt-4 pb-2`}
      >
        <Latex>{`$$ \\begin{aligned} ${preview} \\end{aligned} $$`}</Latex>
      </Box>
      {questionType === "dynamic" && (
        <Box
          mt="md"
          className={`flex items-center justify-center rounded-md border border-solid ${
            theme.colorScheme === "dark"
              ? "border-slate-800 bg-slate-800"
              : "border-slate-300 bg-slate-200"
          } pt-4 pb-2`}
        >
          <Latex>{`$$ \\begin{aligned} ${finalAnsPreview} \\end{aligned} $$`}</Latex>
        </Box>
      )}

      {questionType === "static" && (
        <>
          <Flex mt="xl" align="center">
            <Text weight={500} size="sm">
              Answers <span className="text-red-500">*</span>
            </Text>
            <Tooltip
              withArrow
              label="At least 2 options are necessary (eg. True / False). The order doesn't matter."
            >
              <ActionIcon
                variant="transparent"
                radius="xl"
                ml="lg"
                className="cursor-help"
              >
                <IconHelp
                  size={20}
                  color={theme.colorScheme === "dark" ? "white" : "black"}
                />
              </ActionIcon>
            </Tooltip>
          </Flex>
          <DragDropContext
            onDragEnd={({ destination, source }) =>
              form.reorderListItem("answers", {
                from: source.index,
                to: destination?.index ?? source.index,
              })
            }
          >
            <Droppable droppableId="answers-dnd" direction="vertical">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {answerFields}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <Button
            fullWidth
            variant="light"
            color="gray"
            className={
              theme.colorScheme === "dark" ? "bg-zinc-800" : "bg-gray-100"
            }
            radius="sm"
            mt="md"
            onClick={newAnswer}
          >
            <IconPlus size={16} />
          </Button>
        </>
      )}

      <Divider mt="xl" variant="dashed" />
      <Button
        fullWidth
        variant="light"
        color="cyan"
        radius="sm"
        my="xl"
        type="submit"
        loading={
          !currQuestionId && !currVariationId
            ? addQuestionStatus === "loading"
            : editQuestionStatus === "loading"
        }
        onClick={() => {
          if (questionType === "static") {
            if (!form.values.answers) {
              form.setFieldValue("answers", []);
            }
            if (form.values.variables && form.values.variables.length === 0) {
              form.setFieldValue("variables", undefined);
            }
            if (form.values.methods && form.values.methods.length === 0) {
              form.setFieldValue("methods", undefined);
            }
          } else {
            form.setFieldValue("answers", undefined);
            if (!form.values.variables) {
              form.setFieldValue("variables", []);
            }
            if (!form.values.methods) {
              form.setFieldValue("methods", []);
            }
          }
        }}
      >
        {!currQuestionId && !currVariationId
          ? "Create Question"
          : "Save Question"}
      </Button>
      {currQuestionId !== undefined && (
        <Button
          fullWidth
          variant="light"
          color="red"
          radius="sm"
          my="xl"
          onClick={() => setConfirmDeleteOpened(true)}
        >
          Delete Question
        </Button>
      )}

      {/* Question Delete Confirmation Modal */}
      <Modal
        opened={confirmDeleteOpened}
        onClose={() => setConfirmDeleteOpened(false)}
        size="auto"
        withCloseButton={false}
        centered
      >
        <Group position="apart" align="center" mb="lg">
          <Text weight={500} size="lg">
            Are you sure you want to delete this question?
          </Text>
          <ActionIcon
            variant="transparent"
            color="gray"
            radius="sm"
            onClick={() => setConfirmDeleteOpened(false)}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
        <Button
          fullWidth
          variant="light"
          color="red"
          radius="sm"
          type="submit"
          loading={deleteQuestionStatus === "loading"}
          onClick={() => {
            if (currQuestionId !== undefined && currVariationId !== undefined){
              deleteQuestion({
                questionId: currQuestionId,
                variationId: currVariationId,
              });
            }
            setConfirmDeleteOpened(false);
            setQuestionEditOpened(false);
          }}
        >
          Confirm Delete
        </Button>
      </Modal>

      {/* Raw Data Modal */}
      <Modal
        size={mobile ? "95%" : "xl"}
        title="Raw Data"
        opened={rawDataOpened}
        onClose={() => setRawDataOpened(false)}
        overflow="inside"
      >
        <Prism language="json" withLineNumbers>
          {JSON.stringify(form.values, null, 2)}
        </Prism>
      </Modal>

      {/* Floating Affix Buttons */}
      <Affix position={{ bottom: 50, right: 20 }}>
        <Button
          compact
          color="orange"
          opacity={0.75}
          leftIcon={<IconEraser size={16} />}
          onClick={() => {
            form.setFieldValue("baseQuestionId", undefined);
            form.setFieldValue("title", "");
            form.setFieldValue("difficulty", undefined);
            form.setFieldValue("topic", "");
            setFilteredCourses([]);
            editorHtml.current = "";
            form.setFieldValue("variables", undefined);
            form.setFieldValue("methods", undefined);
            form.setFieldValue("answers", undefined);
            form.setFieldValue("variables", undefined);
            form.setFieldValue("hints", undefined);
            setPreview(previewMessage);
            setFinalAnsPreview(previewFinalAnsMessage);
          }}
        >
          Clear All
        </Button>
      </Affix>
      <Affix position={{ bottom: 20, right: 20 }}>
        <Button
          compact
          color="red"
          opacity={0.75}
          leftIcon={<IconX size={16} />}
          onClick={() => {
            setQuestionAddOpened(false);
            setQuestionEditOpened(false);
          }}
        >
          Cancel
        </Button>
      </Affix>
    </form>
  );
}

const useStyles = createStyles((theme) => ({
  box: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "border-slate-300",
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.fn.variant({
            variant: "light",
            color: "bg-slate-200",
          }).background
        : "lightgrey",
    color:
      theme.colorScheme === "dark"
        ? theme.fn.variant({ variant: "light", color: theme.primaryColor })
            .color
        : "bg-slate-200",
    flex: 1,
    alignSelf: "stretch",
  },
}));
