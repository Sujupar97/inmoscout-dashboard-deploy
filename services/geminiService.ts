import { GoogleGenAI } from "@google/genai";
import { Property, ChatMessage } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("La variable de entorno API_KEY no está configurada.");
}

// Initialize with a check for the API key.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const parseAIResponse = (responseText: string): string | { type: 'property_list'; properties: Pick<Property, 'id' | 'title' | 'location' | 'price'>[] } => {
    // This regex is more robust for finding JSON within markdown blocks.
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            // Validate the parsed structure
            if (parsed.type === 'property_list' && Array.isArray(parsed.properties)) {
                return parsed;
            }
        } catch (e) {
            console.error("No se pudo analizar el JSON de la respuesta de la IA:", e);
            // If parsing fails, return the original text so the user can see what the AI sent.
            return responseText;
        }
    }
    return responseText;
}

export const answerQuestionAboutProperties = async (
  question: string,
  properties: Property[]
): Promise<string | { type: 'property_list'; properties: Pick<Property, 'id' | 'title' | 'location' | 'price'>[] }> => {
  if (!ai) {
      return "La clave de API de Gemini no está configurada o no es válida.";
  }
  
  // Create a richer, cleaner dataset for the AI. Numbers are kept as numbers for calculations.
  const propertiesForAI = properties.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    status: p.status,
    location: p.location,
    zone: p.zona,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    total_sqm_ponderado: p.total_calculated_sqm,
    price_per_sqm_ponderado: p.calculated_price_per_sqm,
    days_on_market: p.days_on_market,
    views: p.visualizaciones,
    // Key metrics for comparison and analysis
    zone_avg_price_per_sqm: p.averagePricePerSqm,
    discount_percentage: p.discountPercentage
  }));

  const prompt = `
    Eres "InmoScout Analyst", un asistente de IA experto en análisis de datos inmobiliarios, con la capacidad de realizar cálculos y comparaciones complejas. Tu única fuente de verdad es el JSON de propiedades que te proporciono. NO inventes información.

    **TUS SUPERPODERES:**
    - **Cálculos complejos:** Puedes calcular promedios, medianas, sumas, y encontrar propiedades que cumplan con múltiples criterios (ej: "propiedad con más baños por menos de 150k en Belgrano").
    - **Análisis Comparativo:** Puedes comparar propiedades, barrios o grupos de propiedades basándote en cualquier atributo disponible (precio/m², descuento, días en mercado, etc.).
    - **Identificación de Oportunidades:** Puedes identificar las mejores oportunidades basándote en una combinación de factores, no solo el descuento. Justifica tus respuestas.
    - **Respuestas Claras:** Presenta tus respuestas de forma clara y concisa. Usa markdown (negritas, listas) para mejorar la legibilidad cuando respondes con texto.

    **REGLA DE RESPUESTA CRÍTICA:**
    1.  Si la pregunta del usuario es una solicitud CLARA de una lista, ranking o grupo de propiedades (ej: "dame las 3 más baratas", "las mejores oportunidades"), DEBES responder EXCLUSIVAMENTE con un bloque de código JSON con la siguiente estructura:
        \`\`\`json
        {
          "type": "property_list",
          "properties": [
            { "id": "...", "title": "...", "location": "...", "price": ... },
            ...
          ]
        }
        \`\`\`
    2.  Para CUALQUIER OTRA pregunta que requiera análisis, cálculo o una explicación (ej: "¿cuál es la zona con mayor descuento promedio?", "¿por qué esta propiedad es una buena oportunidad?", "compara el precio/m² de Palermo vs Belgrano"), responde con TEXTO PLANO en español, utilizando markdown para estructurar la respuesta.

    **BASE DE DATOS DE PROPIEDADES (JSON):**
    ${JSON.stringify(propertiesForAI, null, 2)}
    
    **PREGUNTA DEL USUARIO:**
    "${question}"

    Analiza la pregunta, utiliza tus superpoderes de cálculo y comparación, y responde siguiendo la REGLA CRÍTICA.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    // The text property directly gives the string response from the model.
    return parseAIResponse(response.text.trim());

  } catch (error) {
    console.error("Error llamando a la API de Gemini:", error);
    return "Hubo un error al procesar tu pregunta con la IA. Por favor, revisa la consola para más detalles.";
  }
};