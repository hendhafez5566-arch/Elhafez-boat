import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createProvisionalBooking, publishedPrograms, type BookingRequest, type Program } from "../../../packages/contracts/src/menu.js";

const programs: Program[] = [];
const bookings: BookingRequest[] = [];
const port = Number(process.env.PORT ?? 4000);
const server = createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/health" && req.method === "GET") return send(200, { status: "ok", mode: "development-only" });
  // Explicitly avoid exposing unprotected write APIs: tenant auth is not implemented yet.
  if (req.url === "/api/status" && req.method === "GET") return send(200, { stage: 0, liveWhatsApp: false, authEnabled: false });
  if (req.url?.startsWith("/api/") ) return send(501, { error: "Authentication and persistent tenant-scoped API not implemented" });
  return send(404, { error: "Not found" });
});
server.listen(port, () => console.log("Elhafez Boat development API listening on " + port));
