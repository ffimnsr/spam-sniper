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
    static func verifyDetachedSignature(signedData: Data, signatureData: Data) throws {
        let keys = try readTrustedKeys()
        try verifyDetachedSignature(signedData: signedData, signatureData: signatureData, using: keys)
    }

    static func verifyDetachedSignature(signedData: Data, signatureData: Data, publicKeyData: Data) throws {
        let keys: [Key]
        do {
            keys = try ObjectivePGP.readKeys(from: publicKeyData)
        } catch {
            throw BlocklistSignatureVerifierError.invalidSignature
        }

        try verifyDetachedSignature(signedData: signedData, signatureData: signatureData, using: keys)
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
