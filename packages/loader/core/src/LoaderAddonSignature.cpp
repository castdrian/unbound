#include "LoaderAddonSignature.h"

namespace loader {
std::string addonSigningMessage(const std::string &id, const std::string &version,
                                const std::string &bundle)
{
    return "unbound-addon/v1\n" + id + "\n" + version + "\n" + sha512Hex(bundle);
}

static std::string stringField(const nlohmann::json &object, const char *key)
{
    auto field = object.find(key);
    return field != object.end() && field->is_string() ? field->get<std::string>() : "";
}

AddonSignatureResult verifyAddonSignature(const nlohmann::json &manifest, const std::string &bundle,
                                          const BundleTrust &trust)
{
    auto signature = manifest.find("signature");
    if (signature == manifest.end() || signature->is_null())
    {
        return {AddonSignatureStatus::Unsigned, TrustedSigner::None, {}};
    }
    if (!signature->is_object() || !(*signature)["version"].is_number_integer() ||
        (*signature)["version"].get<int64_t>() != 1)
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the manifest signature has an unknown format"};
    }

    std::string ed25519 = stringField(*signature, "ed25519");
    std::string id      = stringField(manifest, "id");
    std::string version = stringField(manifest, "version");
    if (ed25519.empty() || id.empty() || version.empty())
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the manifest signature, id or version is missing"};
    }
    if (!trust.isEnabled())
    {
        return {AddonSignatureStatus::Unsigned, TrustedSigner::None,
                "this loader was built without a signing key"};
    }

    TrustedSigner signer =
        verifyTrustedSignature(addonSigningMessage(id, version, bundle), ed25519, trust);
    if (signer == TrustedSigner::None)
    {
        return {AddonSignatureStatus::Invalid, TrustedSigner::None,
                "the signature does not match the bundle"};
    }
    return {AddonSignatureStatus::Signed, signer, {}};
}

const char *describeAddonSignature(AddonSignatureStatus status)
{
    switch (status)
    {
        case AddonSignatureStatus::Signed:
            return "signed";
        case AddonSignatureStatus::Invalid:
            return "invalid";
        case AddonSignatureStatus::Unsigned:
            return "unsigned";
    }
    return "unsigned";
}
}
