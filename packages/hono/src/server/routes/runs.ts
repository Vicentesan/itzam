import { getRunByIdAndUserId } from "@itzam/server/db/run/actions";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import type { z } from "zod";
import {
  GetRunByIdParamsSchema,
  GetRunByIdResponseSchema,
} from "../../client/schemas";
import { createErrorResponse } from "../../errors";
import { apiKeyMiddleware } from "../api-key-validator";
import { createOpenApiErrors } from "../docs";

export const runsRoute = new Hono().use(apiKeyMiddleware).get(
  "/:id",
  describeRoute({
    summary: "Get run by ID",
    description: "Retrieve the run details by its ID",
    operationId: "getRunById",
    responses: createOpenApiErrors({
      content: {
        "application/json": {
          schema: resolver(GetRunByIdResponseSchema),
        },
      },
      description: "Successfully retrieved run details",
    }),
  }),
  validator("param", GetRunByIdParamsSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");

    try {
      const run = await getRunByIdAndUserId(id, userId);

      if (!run) {
        return c.json(createErrorResponse(404, "Run not found"), 404);
      }

      const response: z.infer<typeof GetRunByIdResponseSchema> = {
        id: run.id,
        origin: run.origin,
        status: run.status,
        input: run.input,
        output: run.output ?? "",
        prompt: run.prompt,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        cost: run.cost,
        durationInMs: run.durationInMs,
        threadId: run.threadId ?? null,
        model: {
          name: run.model?.name ?? "",
          tag: run.model?.tag ?? "",
        },
        attachments: run.attachments.map((attachment) => ({
          id: attachment.id,
          url: attachment.url,
          mimeType: attachment.mimeType,
        })),
        knowledge: run.runResources.map((resource) => ({
          id: resource.resource.id,
          title: resource.resource.title,
          url: resource.resource.url,
          type: resource.resource.type,
          // if the resource is from a context, return the context object
          context: resource.resource.context
            ? {
                id: resource.resource.context.id,
                slug: resource.resource.context.slug,
                name: resource.resource.context.name,
              }
            : null,
        })),
        workflowId: run.workflowId ?? "",
        createdAt: run.createdAt.toISOString(),
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        createErrorResponse(500, "Unknown error", {
          context: {
            endpoint: "/runs/:id",
            userId,
          },
        }),
        500
      );
    }
  }
);
