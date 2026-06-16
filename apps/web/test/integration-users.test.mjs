import assert from "node:assert/strict";
import test from "node:test";

import { createInstitutionalIdentity } from "./helpers/integration-users.mjs";

test("MVP integration identities satisfy institutional auth trigger shape", () => {
  const identity = createInstitutionalIdentity("Finder", "535");
  const [localPart, domain] = identity.email.split("@");
  const [firstNameToken, nimToken] = localPart.split(".");

  assert.equal(domain, "stu.untar.ac.id");
  assert.equal(firstNameToken, identity.fullName.split(/\s+/)[0].toLowerCase());
  assert.equal(nimToken, identity.nim);
});
