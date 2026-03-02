import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function genUrl(base: string, params: Record<string, string> = {}) {
  const items = Object.entries(params).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  return items.length > 0 ? `${base}?${items.join("&")}` : base;
}

// Simple cookie jar for managing cookies across requests
class SimpleCookieJar {
  private cookies: Map<string, string> = new Map();

  addFromHeaders(headers: Headers) {
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const parts = sc.split(";")[0].split("=");
      const name = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      this.cookies.set(name, value);
    }
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
}

interface MagisterSession {
  accessToken: string;
  hostname: string;
  userId: number;
}

async function magisterLogin(
  hostname: string,
  username: string,
  password: string
): Promise<MagisterSession> {
  const authority = "https://accounts.magister.net";
  const jar = new SimpleCookieJar();

  // 1. Get OpenID endpoints
  const endpoints: any = await (
    await fetch(`${authority}/.well-known/openid-configuration`)
  ).json();

  const clientId = `M6-${hostname}`;
  const redirectUri = `https://${hostname}/oidc/redirect_callback.html`;
  const defaultState = "0".repeat(32);
  const defaultNonce = "0".repeat(32);

  const queryParams = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token token",
    scope: "openid profile",
    acr_values: `tenant:${hostname}`,
    state: defaultState,
    nonce: defaultNonce,
  };

  // 2. Init cookies - visit authorization endpoint
  const authUrl = genUrl(endpoints.authorization_endpoint, queryParams);
  const initRes = await fetch(authUrl, { redirect: "follow" });
  jar.addFromHeaders(initRes.headers);

  // Extract sessionId from the final URL
  const finalUrl = new URL(initRes.url);
  const sessionId = finalUrl.searchParams.get("sessionId") || "";

  // Read body to consume the response
  const mainHTML = await initRes.text();

  // 3. Fetch the authCode from the maintained gist (changes frequently)
  let authCode = "";
  try {
    const authCodeRes = await fetch(
      "https://gist.githubusercontent.com/robbertkl/995a359d1c9641892e3de1ed9af18b15/raw/authcode.json"
    );
    const authCodeData = await authCodeRes.json();
    authCode = typeof authCodeData === "string" ? authCodeData : (authCodeData?.code || "");
  } catch (e) {
    console.error("Could not fetch authCode from gist:", e);
  }

  if (!authCode) {
    throw new Error("Kan authCode niet ophalen. Probeer het later opnieuw.");
  }

  const returnUrl = genUrl("/connect/authorize/callback", queryParams);

  // Helper to submit a challenge
  async function submitChallenge(
    name: string,
    optionalData?: { name: string; value: string }
  ): Promise<any> {
    const xsrfToken = jar.get("XSRF-TOKEN") || "";

    const postData: any = {
      sessionId,
      returnUrl,
    };
    if (authCode) {
      postData.authCode = authCode;
    }
    if (optionalData) {
      postData[optionalData.name] = optionalData.value;
    }

    const res = await fetch(`${authority}/challenges/${name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-xsrf-token": decodeURIComponent(xsrfToken),
        cookie: jar.toString(),
      },
      body: JSON.stringify(postData),
      redirect: "manual",
    });
    jar.addFromHeaders(res.headers);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  // 4. Submit challenges
  await submitChallenge("current");
  await submitChallenge("username", { name: "username", value: username });
  const passwordRes = await submitChallenge("password", {
    name: "password",
    value: password,
  });

  if (!passwordRes.redirectURL) {
    throw new Error(
      passwordRes.error || "Inloggen mislukt. Controleer je gegevens."
    );
  }

  // 5. Follow redirect to get access token
  const redirectUrl = `${authority}${passwordRes.redirectURL}`;
  const redirectRes = await fetch(redirectUrl, {
    headers: { cookie: jar.toString() },
    redirect: "manual",
  });

  const location = redirectRes.headers.get("location") || "";
  // Parse the hash fragment for access_token
  const hashPart = location.split("#")[1] || "";
  const hashParams: Record<string, string> = {};
  for (const part of hashPart.split("&")) {
    const [k, v] = part.split("=");
    if (k && v) hashParams[k] = decodeURIComponent(v);
  }

  const accessToken = hashParams["access_token"];
  if (!accessToken) {
    throw new Error("Geen access token ontvangen van Magister");
  }

  // 6. Get user info
  const accountRes = await fetch(
    `https://${hostname}/api/account?noCache=0`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
    }
  );
  const accountData = await accountRes.json();
  const userId = accountData.Persoon?.Id;

  if (!userId) throw new Error("Kan gebruikersgegevens niet ophalen");

  return { accessToken, hostname, userId };
}

async function fetchGrades(session: MagisterSession): Promise<any[]> {
  const { accessToken, hostname, userId } = session;

  // Get enrollments
  const enrollRes = await fetch(
    `https://${hostname}/api/personen/${userId}/aanmeldingen`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  const enrollData = await enrollRes.json();

  const allGrades: any[] = [];

  for (const item of enrollData.Items || []) {
    const aanmeldingRes = await fetch(
      `https://${hostname}/api/aanmeldingen/${item.Id}`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    const aanmelding = await aanmeldingRes.json();

    const einde = aanmelding.einde;
    const gradesUrl = `https://${hostname}/api/personen/${userId}/aanmeldingen/${item.Id}/cijfers/cijferoverzichtvooraanmelding?actievePerioden=true&alleenBerekendeKolommen=false&alleenPTAKolommen=false&peildatum=${einde}`;

    const gradesRes = await fetch(gradesUrl, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const gradesData = await gradesRes.json();

    if (gradesData.Items) {
      for (const g of gradesData.Items) {
        // Each item has vakken (subjects) with cijfers (grades)
        if (g.CijferKolommen) {
          for (const kolom of g.CijferKolommen) {
            if (kolom.CijferStr && !isNaN(parseFloat(kolom.CijferStr.replace(",", ".")))) {
              allGrades.push({
                subject: g.Vak?.Omschrijving || "Onbekend",
                grade: parseFloat(kolom.CijferStr.replace(",", ".")),
                description: kolom.KolomOmschrijving || "",
                date: kolom.DatumIngevoerd?.split("T")[0] || new Date().toISOString().split("T")[0],
              });
            }
          }
        }
      }
    }
  }

  return allGrades;
}

async function fetchHomework(session: MagisterSession): Promise<any[]> {
  const { accessToken, hostname, userId } = session;

  // Get appointments (huiswerk/afspraken) for next 30 days
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const van = now.toISOString().split("T")[0];
  const tot = future.toISOString().split("T")[0];

  const res = await fetch(
    `https://${hostname}/api/personen/${userId}/afspraken?status=1&van=${van}&tot=${tot}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();

  const homework: any[] = [];

  for (const item of data.Items || []) {
    // Only include items with homework (Inhoud = homework description)
    if (item.Inhoud || item.InfoType === 1) {
      homework.push({
        title: item.Inhoud || item.Omschrijving || "Huiswerk",
        subject: item.Vakken?.[0]?.Naam || item.Omschrijving || "Onbekend",
        dueDate: item.Einde?.split("T")[0] || item.Start?.split("T")[0] || van,
      });
    }
  }

  return homework;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const userId = data.claims.sub as string;

    const body = await req.json();
    const { school, username, password, importGrades, importHomework } = body;

    if (!school || !username || !password) {
      return new Response(
        JSON.stringify({ error: "Vul alle velden in" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }

    // Normalize hostname
    const hostname = school.includes(".magister.net")
      ? school.replace("https://", "").replace("http://", "").replace("/", "")
      : `${school}.magister.net`;

    // Login to Magister
    const session = await magisterLogin(hostname, username, password);

    const result: any = { gradesImported: 0, homeworkImported: 0 };

    // Import grades
    if (importGrades) {
      const grades = await fetchGrades(session);
      if (grades.length > 0) {
        const gradeRows = grades.map((g) => ({
          user_id: userId,
          subject: g.subject,
          grade: g.grade,
          description: g.description,
          date: g.date,
        }));

        const { error } = await supabase.from("grades").insert(gradeRows);
        if (error) throw error;
        result.gradesImported = grades.length;
      }
    }

    // Import homework
    if (importHomework) {
      const homework = await fetchHomework(session);
      if (homework.length > 0) {
        const taskRows = homework.map((h) => ({
          user_id: userId,
          title: h.title.substring(0, 200),
          subject: h.subject,
          due_date: h.dueDate,
          estimated_minutes: 30,
          priority: "medium",
        }));

        const { error } = await supabase.from("tasks").insert(taskRows);
        if (error) throw error;
        result.homeworkImported = homework.length;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Magister import error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Er ging iets mis" }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      }
    );
  }
});
