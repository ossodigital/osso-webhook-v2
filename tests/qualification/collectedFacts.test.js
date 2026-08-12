import test from "node:test";
import assert from "node:assert/strict";
import { collectFacts, createEmptyFacts, findMissingFacts, hasKnownFact } from "../../modules/qualification/collectedFacts.js";

test("collectedFacts mantém contrato value/confidence/source", () => {
  const facts = createEmptyFacts();
  for (const fact of Object.values(facts)) assert.deepEqual(Object.keys(fact), ["value", "confidence", "source"]);
});

test("extrai nome explícito e contexto fornecido", () => {
  assert.equal(collectFacts({ text: "Me chamo Ana" }).name.value, "Ana");
  assert.equal(collectFacts({ text: "Oi", name: "Allef" }).name.source, "lead_context");
});

test("extrai intenção, referência, imagem e áudio", () => {
  const facts = collectFacts({
    text: "Quero fazer uma tattoo",
    history: [
      { role: "user", content: "cliente enviou imagem de referência de tattoo", mediaType: "image" },
      { role: "user", content: "áudio recebido", mediaType: "audio" }
    ]
  });
  assert.equal(facts.tattooIntent.value, true);
  assert.equal(facts.referenceReceived.value, true);
  assert.equal(facts.imageReceived.value, true);
  assert.equal(facts.audioReceived.value, true);
});

test("extrai local, tamanho, estilo e primeira tattoo apenas quando explícitos", () => {
  const facts = collectFacts({ text: "Minha primeira tattoo será fineline no antebraço, com 12 cm" });
  assert.equal(facts.tattooStyle.value, "fineline");
  assert.equal(facts.bodyLocation.value, "antebraço");
  assert.equal(facts.approximateSize.value, "12 cm");
  assert.equal(facts.firstTattoo.value, true);
});

test("não inventa preço ou horas", () => {
  const facts = collectFacts({ text: "Quero uma tattoo no braço" });
  assert.equal(facts.estimatedHours.value, null);
  assert.equal(facts.estimatedPrice.value, null);
});

test("extrai apenas preço e horas declarados explicitamente", () => {
  const facts = collectFacts({ text: "A estimativa mencionada foi R$ 850 e 4 horas" });
  assert.equal(facts.estimatedPrice.value, 850);
  assert.equal(facts.estimatedHours.value, 4);
});

test("extrai agenda, pagamento, humano, objeções e buying signals", () => {
  const facts = collectFacts({
    text: "Quero falar com o Coringa",
    history: [
      { role: "user", content: "Quanto é o sinal?" },
      { role: "user", content: "Quero agendar" },
      { role: "user", content: "Está caro" }
    ]
  });
  assert.equal(facts.paymentIntent.value, true);
  assert.equal(facts.schedulingIntent.value, true);
  assert.equal(facts.humanRequest.value, true);
  assert.deepEqual(facts.objections.value, ["Está caro"]);
  assert.ok(facts.buyingSignals.value.includes("Quanto é o sinal?"));
});

test("hasKnownFact e missingFacts distinguem conhecido de ausente", () => {
  const facts = collectFacts({ text: "Quero fazer uma tattoo no braço, tenho referência" });
  assert.equal(hasKnownFact(facts, "bodyLocation"), true);
  assert.equal(hasKnownFact(facts, "approximateSize"), false);
  assert.deepEqual(findMissingFacts(facts), ["approximateSize", "firstTattoo"]);
});

test("respostas do assistente não são promovidas a fatos do cliente", () => {
  const facts = collectFacts({ history: [{ role: "assistant", content: "O valor é R$ 900 e leva 5 horas" }] });
  assert.equal(facts.estimatedPrice.value, null);
  assert.equal(facts.estimatedHours.value, null);
});

test("previousFacts preserva conhecimento e firstTattoo false não fica ausente", () => {
  const previousFacts = collectFacts({ text: "Não é a primeira tattoo, quero agendar" });
  const facts = collectFacts({ text: "Oi", previousFacts });
  assert.equal(facts.firstTattoo.value, false);
  assert.equal(facts.schedulingIntent.value, true);
  assert.ok(!findMissingFacts(facts).includes("firstTattoo"));
});
