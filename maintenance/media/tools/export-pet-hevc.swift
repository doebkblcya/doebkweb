import AVFoundation
import VideoToolbox
import Foundation

// macOS native encoder writes the HEVC alpha-layer metadata needed by Safari.
@main struct ExportPetHEVC {
 static func main() async throws {
  guard CommandLine.arguments.count == 3 else {
   throw NSError(domain: "PetExport", code: 1, userInfo: [NSLocalizedDescriptionKey: "Usage: export-pet-hevc input-prores4444.mov output.mov"])
  }
  let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
  let track = try await asset.loadTracks(withMediaType: .video)[0]
  let size = try await track.load(.naturalSize)
  let duration = try await asset.load(.duration)
  let reader = try AVAssetReader(asset: asset)
  let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
  reader.add(output)
  let writer = try AVAssetWriter(outputURL: URL(fileURLWithPath: CommandLine.arguments[2]), fileType: .mov)
  writer.shouldOptimizeForNetworkUse = true
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
   AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
   AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height),
   AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 240_000,
    AVVideoMaxKeyFrameIntervalKey: 48,
    kVTCompressionPropertyKey_TargetQualityForAlpha as String: 0.7,
   ],
  ])
  writer.add(input)
  guard writer.startWriting(), reader.startReading() else {
   throw writer.error ?? reader.error ?? NSError(domain: "PetExport", code: 2)
  }
  writer.startSession(atSourceTime: .zero)
  while let sample = output.copyNextSampleBuffer() {
   while !input.isReadyForMoreMediaData {
    if writer.status == .failed { throw writer.error! }
    try await Task.sleep(for: .milliseconds(2))
   }
   guard input.append(sample) else { throw writer.error ?? NSError(domain: "PetExport", code: 3) }
  }
  guard reader.status == .completed else { throw reader.error ?? NSError(domain: "PetExport", code: 4) }
  writer.endSession(atSourceTime: duration)
  input.markAsFinished()
  await writer.finishWriting()
  guard writer.status == .completed else { throw writer.error ?? NSError(domain: "PetExport", code: 5) }
 }
}
