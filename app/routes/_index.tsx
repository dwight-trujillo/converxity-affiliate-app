import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return json({
    message: "Converxity Affiliate Engine",
    status: "Running",
    version: "1.0.0",
    endpoints: [
      "GET  /              - This page",
      "POST /api/track     - Web Pixel tracking endpoint",
      "GET  /api/health    - Health check",
      "GET  /api/dashboard - Dashboard metrics",
      "GET  /api/affiliates - List affiliates"
    ]
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ 
      fontFamily: "system-ui, sans-serif", 
      maxWidth: "800px", 
      margin: "50px auto", 
      padding: "20px",
      backgroundColor: "#1a1a2e",
      color: "#e0e0e0",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
    }}>
      <h1 style={{ color: "#00d4aa", fontSize: "2rem", marginBottom: "10px" }}>
        ?? {data.message}
      </h1>
      <p style={{ color: "#888", fontSize: "1.1rem" }}>
        Status: <span style={{ color: "#00ff88" }}>{data.status}</span> | 
        Version: <span style={{ color: "#00aaff" }}>{data.version}</span>
      </p>
      
      <div style={{ 
        backgroundColor: "#16213e", 
        padding: "20px", 
        borderRadius: "8px",
        marginTop: "20px" 
      }}>
        <h2 style={{ color: "#ff6b6b", marginTop: "0" }}>?? Available Endpoints</h2>
        <ul style={{ listStyle: "none", padding: "0" }}>
          {data.endpoints.map((ep, i) => (
            <li key={i} style={{ 
              padding: "8px 12px", 
              margin: "4px 0",
              backgroundColor: "#0f3460",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.9rem"
            }}>
              {ep}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ 
        backgroundColor: "#16213e", 
        padding: "20px", 
        borderRadius: "8px",
        marginTop: "20px" 
      }}>
        <h2 style={{ color: "#ffd93d", marginTop: "0" }}>?? Test Affiliate Links</h2>
        <ul style={{ listStyle: "none", padding: "0" }}>
          <li style={{ padding: "6px 0", fontFamily: "monospace" }}>
            <a href="/?ref=MARIAG2026" style={{ color: "#00d4aa" }}>/?ref=MARIAG2026</a> - María García (10%)
          </li>
          <li style={{ padding: "6px 0", fontFamily: "monospace" }}>
            <a href="/?ref=CARLOSR2026" style={{ color: "#00d4aa" }}>/?ref=CARLOSR2026</a> - Carlos Rodríguez (12%)
          </li>
          <li style={{ padding: "6px 0", fontFamily: "monospace" }}>
            <a href="/?ref=ANAM2026" style={{ color: "#00d4aa" }}>/?ref=ANAM2026</a> - Ana Martínez (8%)
          </li>
        </ul>
      </div>

      <p style={{ 
        marginTop: "30px", 
        color: "#555", 
        fontSize: "0.8rem", 
        textAlign: "center" 
      }}>
        Converxity Affiliate Engine MVP • Prisma 5.22 • Remix • SQLite
      </p>
    </div>
  );
}
