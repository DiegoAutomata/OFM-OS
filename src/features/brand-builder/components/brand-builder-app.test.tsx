import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { camiExample } from "../examples";
import { generateMockBrandPlaybook } from "../mock-generator";
import { BrandBuilderApp } from "./brand-builder-app";

const photos = [
  { filename: "one.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "two.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "three.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
];

describe("BrandBuilderApp", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the operator login before the app", () => {
    render(<BrandBuilderApp />);
    expect(screen.getByRole("heading", { name: "Operator access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter OFM OS" })).toBeInTheDocument();
  });

  it("restores the operator session on the agency dashboard", () => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
    render(<BrandBuilderApp />);
    expect(
      screen.getByRole("heading", { name: "Today's operation, at a glance." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brand Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CyberData" })).toBeInTheDocument();
  });

  it("converts USD to ARS with the selected live quote", async () => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          quotes: {
            blue: { casa: "blue", nombre: "Blue", compra: 1200, venta: 1220, fechaActualizacion: "2026-06-19T12:00:00Z" },
            official: { casa: "oficial", nombre: "Oficial", compra: 900, venta: 940, fechaActualizacion: "2026-06-19T12:00:00Z" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<BrandBuilderApp />);
    await screen.findByText("1.220.000");

    fireEvent.change(screen.getByLabelText("USD amount"), { target: { value: "2" } });
    expect(screen.getByText("2.440")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "official" }));
    expect(screen.getByText("1.880")).toBeInTheDocument();
  });

  it("uses one production request without model retry controls", async () => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
    const output = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/exchange-rate")) {
        return new Response(
          JSON.stringify({
            ok: true,
            quotes: {
              blue: { casa: "blue", nombre: "Blue", compra: 1200, venta: 1220, fechaActualizacion: "2026-06-19T12:00:00Z" },
              official: { casa: "oficial", nombre: "Oficial", compra: 900, venta: 940, fechaActualizacion: "2026-06-19T12:00:00Z" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, output, provider: "openai/gpt-5.5" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    render(<BrandBuilderApp />);

    fireEvent.click(screen.getByRole("button", { name: "Brand Builder" }));

    const fileInput = screen.getByLabelText("Select 3 photos");
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["one"], "one.jpg", { type: "image/jpeg" }),
          new File(["two"], "two.jpg", { type: "image/jpeg" }),
          new File(["three"], "three.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    const generateButton = screen.getByRole("button", {
      name: "Generate 3 routes",
    });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    await waitFor(() => {
      const generationCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/api/brand-builder/generate"),
      );
      expect(generationCalls).toHaveLength(1);
    });
    const generationCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/brand-builder/generate"),
    );
    const request = JSON.parse(String(generationCalls[0]?.[1]?.body));
    expect(Object.keys(request)).toEqual(["intake"]);
    expect(screen.queryByRole("button", { name: "Retry with GPT-5.5" })).toBeNull();

    const routeButtons = await screen.findAllByRole("button", { name: "Use this route" });
    fireEvent.click(routeButtons[0]);
    expect(screen.getByLabelText("Final bio")).toHaveValue(output.routes[1].discoveryBio);
  });
});
