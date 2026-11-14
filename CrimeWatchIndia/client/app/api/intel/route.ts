import { NextResponse } from "next/server";

// Comprehensive coordinate map for major hubs, state capitals, and tier-2/3 cities across India
const CITY_COORDS: Record<string, { lat: number; lng: number; state: string }> = {
  // North
  Delhi: { lat: 28.6139, lng: 77.2090, state: "Delhi" },
  "New Delhi": { lat: 28.6139, lng: 77.2090, state: "Delhi" },
  Noida: { lat: 28.5355, lng: 77.3910, state: "Uttar Pradesh" },
  Gurugram: { lat: 28.4595, lng: 77.0266, state: "Haryana" },
  Gurgaon: { lat: 28.4595, lng: 77.0266, state: "Haryana" },
  Lucknow: { lat: 26.8467, lng: 80.9462, state: "Uttar Pradesh" },
  Kanpur: { lat: 26.4499, lng: 80.3319, state: "Uttar Pradesh" },
  Varanasi: { lat: 25.3176, lng: 82.9739, state: "Uttar Pradesh" },
  Agra: { lat: 27.1767, lng: 78.0081, state: "Uttar Pradesh" },
  Meerut: { lat: 28.9845, lng: 77.7064, state: "Uttar Pradesh" },
  Chandigarh: { lat: 30.7333, lng: 76.7794, state: "Chandigarh" },
  Ludhiana: { lat: 30.9010, lng: 75.8573, state: "Punjab" },
  Amritsar: { lat: 31.6340, lng: 74.8723, state: "Punjab" },
  Jaipur: { lat: 26.9124, lng: 75.7873, state: "Rajasthan" },
  Jodhpur: { lat: 26.2389, lng: 73.0243, state: "Rajasthan" },
  Udaipur: { lat: 24.5854, lng: 73.7125, state: "Rajasthan" },
  Dehradun: { lat: 30.3165, lng: 78.0322, state: "Uttarakhand" },
  Srinagar: { lat: 34.0837, lng: 74.7973, state: "Jammu and Kashmir" },
  Jammu: { lat: 32.7266, lng: 74.8570, state: "Jammu and Kashmir" },
  Shimla: { lat: 31.1048, lng: 77.1734, state: "Himachal Pradesh" },

  // West
  Mumbai: { lat: 19.0760, lng: 72.8777, state: "Maharashtra" },
  Pune: { lat: 18.5204, lng: 73.8567, state: "Maharashtra" },
  Nagpur: { lat: 21.1458, lng: 79.0882, state: "Maharashtra" },
  Nashik: { lat: 19.9975, lng: 73.7898, state: "Maharashtra" },
  Thane: { lat: 19.2183, lng: 72.9781, state: "Maharashtra" },
  Ahmedabad: { lat: 23.0225, lng: 72.5714, state: "Gujarat" },
  Surat: { lat: 21.1702, lng: 72.8311, state: "Gujarat" },
  Vadodara: { lat: 22.3072, lng: 73.1812, state: "Gujarat" },
  Rajkot: { lat: 22.3039, lng: 70.8022, state: "Gujarat" },
  Panaji: { lat: 15.4909, lng: 73.8278, state: "Goa" },
  Goa: { lat: 15.2993, lng: 74.1240, state: "Goa" },

  // South
  Bengaluru: { lat: 12.9716, lng: 77.5946, state: "Karnataka" },
  Bangalore: { lat: 12.9716, lng: 77.5946, state: "Karnataka" },
  Mysuru: { lat: 12.2958, lng: 76.6394, state: "Karnataka" },
  Mysore: { lat: 12.2958, lng: 76.6394, state: "Karnataka" },
  Mangaluru: { lat: 12.9141, lng: 74.8560, state: "Karnataka" },
  Chennai: { lat: 13.0827, lng: 80.2707, state: "Tamil Nadu" },
  Coimbatore: { lat: 11.0168, lng: 76.9558, state: "Tamil Nadu" },
  Madurai: { lat: 9.9252, lng: 78.1198, state: "Tamil Nadu" },
  Salem: { lat: 11.6643, lng: 78.1460, state: "Tamil Nadu" },
  Hyderabad: { lat: 17.3850, lng: 78.4867, state: "Telangana" },
  Warangal: { lat: 17.9689, lng: 79.5941, state: "Telangana" },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185, state: "Andhra Pradesh" },
  Vijayawada: { lat: 16.5062, lng: 80.6480, state: "Andhra Pradesh" },
  Tirupati: { lat: 13.6288, lng: 79.4192, state: "Andhra Pradesh" },
  Thiruvananthapuram: { lat: 8.5241, lng: 76.9366, state: "Kerala" },
  Kochi: { lat: 9.9312, lng: 76.2673, state: "Kerala" },
  Kozhikode: { lat: 11.2588, lng: 75.7804, state: "Kerala" },

  // East & Central
  Kolkata: { lat: 22.5726, lng: 88.3639, state: "West Bengal" },
  Howrah: { lat: 22.5958, lng: 88.2636, state: "West Bengal" },
  Siliguri: { lat: 26.7271, lng: 88.3953, state: "West Bengal" },
  Patna: { lat: 25.5941, lng: 85.1376, state: "Bihar" },
  Gaya: { lat: 24.7914, lng: 85.0002, state: "Bihar" },
  Muzaffarpur: { lat: 26.1226, lng: 85.3906, state: "Bihar" },
  Ranchi: { lat: 23.3441, lng: 85.3096, state: "Jharkhand" },
  Jamshedpur: { lat: 22.8046, lng: 86.2029, state: "Jharkhand" },
  Bhubaneswar: { lat: 20.2961, lng: 85.8245, state: "Odisha" },
  Cuttack: { lat: 20.4625, lng: 85.8828, state: "Odisha" },
  Raipur: { lat: 21.2514, lng: 81.6296, state: "Chhattisgarh" },
  Bhopal: { lat: 23.2599, lng: 77.4126, state: "Madhya Pradesh" },
  Indore: { lat: 22.7196, lng: 75.8577, state: "Madhya Pradesh" },
  Gwalior: { lat: 26.2183, lng: 78.1828, state: "Madhya Pradesh" },
  Jabalpur: { lat: 23.1815, lng: 79.9864, state: "Madhya Pradesh" },

  // Northeast
  Guwahati: { lat: 26.1445, lng: 91.7362, state: "Assam" },
  Dibrugarh: { lat: 27.4728, lng: 94.9120, state: "Assam" },
  Silchar: { lat: 24.8333, lng: 92.7789, state: "Assam" },
  Shillong: { lat: 25.5788, lng: 91.8933, state: "Meghalaya" },
  Imphal: { lat: 24.8170, lng: 93.9368, state: "Manipur" },
  Aizawl: { lat: 23.7271, lng: 92.7176, state: "Mizoram" },
  Agartala: { lat: 23.8315, lng: 91.2868, state: "Tripura" },
  Kohima: { lat: 25.6747, lng: 94.1100, state: "Nagaland" },
  Itanagar: { lat: 27.0844, lng: 93.6053, state: "Arunachal Pradesh" },
  Gangtok: { lat: 27.3389, lng: 88.6065, state: "Sikkim" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanXmlText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    // Multiple regional feeds to capture state-level and local English newspaper reporting
    const feeds = [
      // Major national crime & police feeds
      "https://news.google.com/rss/search?q=crime+OR+police+OR+arrest+India+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
      // Regional and state court/police reports
      "https://news.google.com/rss/search?q=murder+OR+shooting+OR+robbery+OR+fraud+police+state+India+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
      // South India regional focus
      "https://news.google.com/rss/search?q=crime+police+Chennai+Bengaluru+Hyderabad+Kochi+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
      // North & East regional focus
      "https://news.google.com/rss/search?q=crime+police+Delhi+Kolkata+Patna+Lucknow+Jaipur+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
      // West & Central regional focus
      "https://news.google.com/rss/search?q=crime+police+Mumbai+Pune+Ahmedabad+Bhopal+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
      // Northeast focus
      "https://news.google.com/rss/search?q=crime+police+Guwahati+Assam+Shillong+Imphal+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
    ];

    const responses = await Promise.all(
      feeds.map((url) => fetch(url, { cache: "no-store" }).then((r) => r.text()).catch(() => ""))
    );

    const now = Date.now();
    const seenTitles = new Set<string>();
    const parsedCrimes = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const descRegex = /<description>([\s\S]*?)<\/description>/;
    const linkRegex = /<link>([\s\S]*?)<\/link>/;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
    const sourceRegex = /<source[^>]*>([\s\S]*?)<\/source>/;

    for (const xmlText of responses) {
      if (!xmlText) continue;
      let match;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const rawTitle = titleRegex.exec(block)?.[1] ?? "";
        const rawDesc = descRegex.exec(block)?.[1] ?? "";
        const link = linkRegex.exec(block)?.[1]?.trim() ?? "";
        const pubDateStr = pubDateRegex.exec(block)?.[1] ?? "";
        const source = cleanXmlText(sourceRegex.exec(block)?.[1] ?? "Local News Desk");

        const cleanTitle = cleanXmlText(rawTitle).replace(/\s+-\s+[^-]+$/, "").trim();
        if (!cleanTitle || seenTitles.has(cleanTitle.toLowerCase())) continue;

        // Filter out irrelevant non-crime news
        const lowerTitle = cleanTitle.toLowerCase();
        const ignoreKeywords = [
          "launch", "price", "suv", "mpv", "car", "bike", "movie", "trailer", 
          "review", "smartphone", "phone", "ipl", "match", "cricket", "tournament", "recipe"
        ];
        if (ignoreKeywords.some((kw) => lowerTitle.includes(kw))) continue;

        // Law & order / crime related filter
        const crimeKeywords = [
          "crime", "police", "arrest", "murder", "killed", "shooting", "robbery", 
          "theft", "fraud", "scam", "cyber", "assault", "gang", "court", "jail", 
          "fir", "probe", "smuggle", "seize", "narcotics", "drug", "accost", "attack",
          "kidnap", "extortion", "looted", "busted", "accused", "vigilance", "custody"
        ];
        const isCrimeRelated = crimeKeywords.some((kw) => lowerTitle.includes(kw));
        if (!isCrimeRelated) continue;

        const pubMs = pubDateStr ? new Date(pubDateStr).getTime() : now;
        const ageMs = Math.max(0, now - pubMs);

        // Severity classification
        let severity: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
        if (/(murder|killed|homicide|shooting|gang|lynch|terror|encounter|rape)/.test(lowerTitle)) {
          severity = "HIGH";
        } else if (/(theft|fraud|scam|cyber|cheating|snatching|forgery)/.test(lowerTitle)) {
          severity = "LOW";
        }

        // Strict time retention windows
        if (severity === "HIGH" && ageMs > 90 * DAY_MS) continue;
        if (severity === "MEDIUM" && ageMs > 30 * DAY_MS) continue;
        if (severity === "LOW" && ageMs > 7 * DAY_MS) continue;

        // Match against local city list
        const combinedText = `${cleanTitle} ${cleanXmlText(rawDesc)}`.toLowerCase();
        let detectedCity = "";
        let coords = { lat: 22.5937, lng: 78.9629, state: "India" }; // fallback center India if no specific city matched

        for (const [city, data] of Object.entries(CITY_COORDS)) {
          // Use word boundary check or strict inclusion for city names
          if (combinedText.includes(city.toLowerCase())) {
            detectedCity = city;
            coords = data;
            break;
          }
        }

        // If no explicit city was found in text, skip or assign default state center if it's a major police story
        if (!detectedCity) continue;

        let cleanSummary = cleanXmlText(rawDesc);
        if (!cleanSummary || cleanSummary.length < 30 || cleanSummary.toLowerCase().startsWith(cleanTitle.toLowerCase().slice(0, 20))) {
          const dateLabel = new Date(pubMs).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          cleanSummary = `${detectedCity.toUpperCase()} (${coords.state}) — Dispatched via ${source} on ${dateLabel}: Local authorities and law enforcement units initiated formal action following reports of "${cleanTitle}." Field investigations and evidence collection remain active across the district.`;
        }

        seenTitles.add(cleanTitle.toLowerCase());
        parsedCrimes.push({
          id: `live-${pubMs}-${Math.random().toString(36).substring(2, 7)}`,
          title: cleanTitle,
          summary: cleanSummary,
          city: detectedCity,
          state: coords.state,
          lat: coords.lat + (Math.random() - 0.5) * 0.04, // slight geographic jitter
          lng: coords.lng + (Math.random() - 0.5) * 0.04,
          severity,
          category: severity === "HIGH" ? "Violent" : severity === "LOW" ? "Cyber / Fraud" : "Law & Order",
          source,
          link,
          publishedAt: new Date(pubMs).toISOString(),
        });
      }
    }

    // Sort newest first
    parsedCrimes.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Return up to 60 dense pins across states
    return NextResponse.json({ success: true, crimes: parsedCrimes.slice(0, 60) });
  } catch (error) {
    console.error("Intel fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to pull live intel" }, { status: 500 });
  }
}