//
//  BlocklistSignatureVerifier.swift
//  SpamSniper
//
//  Created by Codex on 3/22/26.
//

import Foundation
import ObjectivePGP

enum BlocklistSignatureVerifierError: LocalizedError {
    case invalidSignature
    case trustedKeyMissing

    var errorDescription: String? {
        switch self {
        case .invalidSignature, .trustedKeyMissing:
            return "The blocklist signature could not be verified."
        }
    }
}

enum BlocklistSignatureVerifier {
    /// Verify using the bundled trusted community key only.
    static func verifyDetachedSignature(signedData: Data, signatureData: Data) throws {
        let keys = try readTrustedKeys()
        try verifyDetachedSignature(signedData: signedData, signatureData: signatureData, using: keys)
    }

    /// Verify using an explicitly supplied public-key blob.
    static func verifyDetachedSignature(signedData: Data, signatureData: Data, publicKeyData: Data) throws {
        let keys: [Key]
        do {
            keys = try ObjectivePGP.readKeys(from: publicKeyData)
        } catch {
            throw BlocklistSignatureVerifierError.invalidSignature
        }

        try verifyDetachedSignature(signedData: signedData, signatureData: signatureData, using: keys)
    }

    /// Returns the uppercase hex fingerprint of the first key in `publicKeyData`.
    static func fingerprint(of publicKeyData: Data) throws -> String {
        guard let key = try? ObjectivePGP.readKeys(from: publicKeyData).first else {
            throw BlocklistSignatureVerifierError.invalidSignature
        }
        return fingerprintString(for: key)
    }

    private static func fingerprintString(for key: Key) -> String {
        if let fp = key.publicKey?.fingerprint {
            return fp.description.uppercased().replacingOccurrences(of: " ", with: "")
        }
        return key.keyID.longIdentifier.uppercased()
    }

    private static func verifyDetachedSignature(signedData: Data, signatureData: Data, using keys: [Key]) throws {
        do {
            try ObjectivePGP.verify(signedData, withSignature: signatureData, using: keys)
        } catch {
            throw BlocklistSignatureVerifierError.invalidSignature
        }
    }

    private static func readTrustedKeys() throws -> [Key] {
        do {
            return try ObjectivePGP.readKeys(from: trustedPublicKeyData())
        } catch {
            throw BlocklistSignatureVerifierError.invalidSignature
        }
    }

    private static func trustedPublicKeyData() throws -> Data {
        let bundles = [Bundle.main] + Bundle.allBundles + Bundle.allFrameworks
        for bundle in bundles {
            if let url = bundle.url(forResource: "spam-blocklist-trusted-public-key", withExtension: "asc") {
                return try Data(contentsOf: url)
            }
        }

        throw BlocklistSignatureVerifierError.trustedKeyMissing
    }
}
