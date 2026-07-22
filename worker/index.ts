/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

type PlatformEnv = typeof import("cloudflare:workers").env;
type HandlerEnv = NonNullable<Parameters<typeof handler.fetch>[1]>;
type HandlerContext = NonNullable<Parameters<typeof handler.fetch>[2]>;

type ImageBinding = {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

type WorkerEnv = HandlerEnv & PlatformEnv & { IMAGES?: ImageBinding };

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: HandlerContext): Promise<Response> {
    const url = new URL(request.url);

    // Keep the container probe independent from application data and migrations.
    if (url.pathname === "/healthz") {
      return Response.json({ ok: true, service: "jubensha-scheduler" });
    }

    if (url.pathname === "/_vinext/image") {
      if (!env.ASSETS || !env.IMAGES) {
        return Response.json({ error: "当前运行环境未启用图片优化" }, { status: 503 });
      }
      const assets = env.ASSETS;
      const images = env.IMAGES;
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => Promise.resolve(assets.fetch(new Request(new URL(path, request.url)))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
