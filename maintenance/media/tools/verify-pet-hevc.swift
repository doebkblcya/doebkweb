import AVFoundation
import CoreVideo
import Foundation
@main struct Verify {
 static func main() async throws {
  for path in CommandLine.arguments.dropFirst() {
   let asset=AVURLAsset(url:URL(fileURLWithPath:path))
   let track=try await asset.loadTracks(withMediaType:.video)[0]
   let reader=try AVAssetReader(asset:asset)
   let output=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
   reader.add(output); reader.startReading()
   var frames=0; var low=255; var high=0
   while let sample=output.copyNextSampleBuffer(),let pixel=CMSampleBufferGetImageBuffer(sample) {
    CVPixelBufferLockBaseAddress(pixel,.readOnly)
    let b=CVPixelBufferGetBaseAddress(pixel)!.assumingMemoryBound(to:UInt8.self)
    let w=CVPixelBufferGetWidth(pixel),h=CVPixelBufferGetHeight(pixel),stride=CVPixelBufferGetBytesPerRow(pixel)
    for y in 0..<h { for x in 0..<w { let a=Int(b[y*stride+x*4+3]); low=min(low,a); high=max(high,a) } }
    CVPixelBufferUnlockBaseAddress(pixel,.readOnly); frames+=1
   }
   guard reader.status == .completed,frames>0,low == 0,high>240 else { throw reader.error ?? NSError(domain:"AlphaVerification",code:1,userInfo:[NSLocalizedDescriptionKey:path]) }
   print("\(URL(fileURLWithPath:path).lastPathComponent): \(frames) frames, alpha \(low)...\(high)")
  }
 }
}
