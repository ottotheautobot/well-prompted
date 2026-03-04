'use client';

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080B14] to-[#0a0d1a] text-white font-sans">
      {/* Hero */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-[#0085FF] to-[#00d4ff] bg-clip-text text-transparent">
            Well Prompted
          </h1>
          <p className="text-2xl text-gray-300 mb-4">AI-Operated Before/After Content Pipeline</p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Fully automated Instagram content generation, rendering, approval, and publishing. 
            Human judgment at critical gates. AI handles the heavy lifting.
          </p>
        </div>

        {/* Core Idea */}
        <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-8 mb-16">
          <h2 className="text-2xl font-bold mb-4 text-[#0085FF]">The Concept</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-3 text-[#FF2D78]">What</h3>
              <p className="text-gray-300 leading-relaxed">
                An Instagram page (@well.prompted) that teaches prompt engineering through 
                before/after comparisons. Each post shows a real, flawed prompt and how to improve it 
                with concrete techniques that actually work across models.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 text-[#FF2D78]">Why</h3>
              <p className="text-gray-300 leading-relaxed">
                Most people write bad prompts instinctively. They're vague, context-starved, 
                and expect the AI to guess intent. Teaching them to prompt better creates 
                measurable improvement in their own work.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 text-[#FF2D78]">How</h3>
              <p className="text-gray-300 leading-relaxed">
                Content matrix: 19 scenarios (Career, Job Search, Knowledge Work, Writing) covering 
                real situations people actually face. Each generates a unique before/after + explanation.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 text-[#FF2D78]">Scale</h3>
              <p className="text-gray-300 leading-relaxed">
                AI generates content. Humans approve. System publishes 1-2/day organically. 
                No manual work per post once approved — pipeline is fully automated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="px-6 py-24 bg-[#0a0d1a] border-y border-[#0085FF]/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-16 text-center">The Pipeline</h2>
          
          <div className="space-y-6">
            {/* Generation */}
            <div className="bg-[#0f1420] border border-[#0085FF]/50 rounded-lg p-6 hover:border-[#0085FF] transition">
              <div className="flex items-start gap-4">
                <div className="bg-[#0085FF] text-[#080B14] font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg">1</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Generation</h3>
                  <p className="text-gray-300 mb-3">Claude Haiku runs prompts through scenario matrix, generates before/after + why breakdown.</p>
                  <div className="bg-[#0a0d1a] rounded p-3 text-sm text-gray-400 font-mono">
                    → Portal: Generate Content → Select category/scenario → AI creates post
                  </div>
                </div>
              </div>
            </div>

            {/* Content Approval */}
            <div className="bg-[#0f1420] border border-[#0085FF]/50 rounded-lg p-6 hover:border-[#0085FF] transition">
              <div className="flex items-start gap-4">
                <div className="bg-[#0085FF] text-[#080B14] font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg">2</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Content Approval</h3>
                  <p className="text-gray-300 mb-3">Human reviews generated prompts, descriptions, and whether the advice actually works. Can regenerate sections.</p>
                  <div className="bg-[#0a0d1a] rounded p-3 text-sm text-gray-400 font-mono">
                    → Portal Queue → Expand, read, approve or redo specific section
                  </div>
                </div>
              </div>
            </div>

            {/* Video Render */}
            <div className="bg-[#0f1420] border border-[#0085FF]/50 rounded-lg p-6 hover:border-[#0085FF] transition">
              <div className="flex items-start gap-4">
                <div className="bg-[#0085FF] text-[#080B14] font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg">3</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Video Render</h3>
                  <p className="text-gray-300 mb-3">Remotion Lambda generates 9:16 Reel (2-page format): Page 1 shows okay vs well prompt with typing animation. Page 2 explains why with 5 key points.</p>
                  <div className="bg-[#0a0d1a] rounded p-3 text-sm text-gray-400 font-mono">
                    → ElevenLabs narration (female voice) + pre-clipped WAV music synced to timing
                  </div>
                </div>
              </div>
            </div>

            {/* Video Approval */}
            <div className="bg-[#0f1420] border border-[#0085FF]/50 rounded-lg p-6 hover:border-[#0085FF] transition">
              <div className="flex items-start gap-4">
                <div className="bg-[#0085FF] text-[#080B14] font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg">4</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Video Approval & Scheduling</h3>
                  <p className="text-gray-300 mb-3">Human watches video, approves or regenerates audio. Drag onto calendar to schedule, or auto-schedule into next available slot.</p>
                  <div className="bg-[#0a0d1a] rounded p-3 text-sm text-gray-400 font-mono">
                    → Portal Schedule page → 12 slots/week (1-2 per day) → Auto-publishes at time
                  </div>
                </div>
              </div>
            </div>

            {/* Publishing */}
            <div className="bg-[#0f1420] border border-[#0085FF]/50 rounded-lg p-6 hover:border-[#0085FF] transition">
              <div className="flex items-start gap-4">
                <div className="bg-[#0085FF] text-[#080B14] font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg">5</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Publishing</h3>
                  <p className="text-gray-300 mb-3">Cron job publishes via Instagram Graph API at scheduled times. Metrics pulled automatically (reach, watch time, engagement).</p>
                  <div className="bg-[#0a0d1a] rounded p-3 text-sm text-gray-400 font-mono">
                    → Graph API (Facebook → Instagram) → Posts with caption + video → Auto-update metrics
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-16 text-center">Tech Stack</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Frontend */}
          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Portal (Frontend)</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Next.js 15</strong> — full-stack React</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>TailwindCSS</strong> — styling</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Vercel</strong> — hosting</span>
              </li>
            </ul>
          </div>

          {/* Backend */}
          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Backend & Data</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Supabase</strong> — PostgreSQL, auth, file storage</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Next.js API Routes</strong> — edge functions</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>OpenClaw Cron</strong> — scheduled tasks (publish, token refresh)</span>
              </li>
            </ul>
          </div>

          {/* Content Generation */}
          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Content Generation</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Claude (Anthropic)</strong> — haiku model for scenarios, generation</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>ElevenLabs</strong> — TTS narration (female voice, 128kbps MP3)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Pre-clipped WAV tracks</strong> — 4 background music loops on S3</span>
              </li>
            </ul>
          </div>

          {/* Video & Publishing */}
          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Video & Publishing</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Remotion Lambda</strong> — video rendering (AWS Lambda)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>Instagram Graph API</strong> — publish via Facebook Business app</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF2D78] rounded-full"></span>
                <span><strong>AWS S3</strong> — video + asset hosting (us-east-2)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Why Each Tool */}
        <div className="bg-[#0f1420] border border-[#0085FF]/20 rounded-lg p-8 mt-12">
          <h3 className="text-2xl font-bold mb-6 text-[#0085FF]">Why These Tools?</h3>
          <div className="space-y-4 text-gray-300">
            <p>
              <strong className="text-[#FF2D78]">Claude Haiku</strong> — Fast, cheap, capable enough for structured generation. 
              We run prompts through it, get real outputs to compare in the before/after.
            </p>
            <p>
              <strong className="text-[#FF2D78]">Remotion</strong> — Only solution for programmatic video generation at scale. 
              React-based so we can parameterize everything, Lambda handles rendering without EC2 overhead.
            </p>
            <p>
              <strong className="text-[#FF2D78]">ElevenLabs</strong> — Natural voice synthesis with SSML support. 
              Pre-clipped WAVs (not Epidemic Sound API) keep it free and deterministic.
            </p>
            <p>
              <strong className="text-[#FF2D78]">Instagram Graph API</strong> — Direct publishing without manual uploads. 
              Requires Business account + Facebook Page connection, but unlocks automation completely.
            </p>
            <p>
              <strong className="text-[#FF2D78]">Supabase</strong> — PostgreSQL with real-time subscriptions. 
              Simple REST API, works beautifully with Next.js, free tier covers our usage.
            </p>
          </div>
        </div>
      </section>

      {/* Key Numbers */}
      <section className="px-6 py-24 bg-[#0a0d1a] border-y border-[#0085FF]/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-16 text-center">By The Numbers</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-[#0f1420] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-[#0085FF] mb-2">19</div>
              <p className="text-gray-400">Content Scenarios</p>
              <p className="text-sm text-gray-500 mt-2">Career, Job Search, Knowledge Work, Writing</p>
            </div>
            
            <div className="bg-[#0f1420] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-[#FF2D78] mb-2">30s</div>
              <p className="text-gray-400">Video Length</p>
              <p className="text-sm text-gray-500 mt-2">Instagram Reel format, 9:16</p>
            </div>
            
            <div className="bg-[#0f1420] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-[#0085FF] mb-2">1-2</div>
              <p className="text-gray-400">Posts/Day</p>
              <p className="text-sm text-gray-500 mt-2">Organic growth cadence</p>
            </div>
            
            <div className="bg-[#0f1420] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-[#FF2D78] mb-2">2</div>
              <p className="text-gray-400">Human Gates</p>
              <p className="text-sm text-gray-500 mt-2">Content approval, video approval</p>
            </div>
          </div>
        </div>
      </section>

      {/* Content Specs */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-16 text-center">Content Specs</h2>
        
        <div className="space-y-6">
          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-3 text-[#0085FF]">Page 1: The Comparison</h3>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li>• <strong>Left pane:</strong> "OKAY PROMPT" (bad real-world prompt, static)</li>
              <li>• <strong>Right pane:</strong> "WELL PROMPTED" (improved version, types in at 26 chars/sec)</li>
              <li>• <strong>Dynamics:</strong> Pane heights adjust to content length. Blue cursor blinks during typing.</li>
              <li>• <strong>Font:</strong> 21px titles, proportional description sizes</li>
            </ul>
          </div>

          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-3 text-[#0085FF]">Page 2: Why This Works</h3>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li>• <strong>5 key points</strong> explaining the technique, improvements, rationale</li>
              <li>• <strong>Title + description:</strong> Dynamic font sizing (46-72px titles depending on item count)</li>
              <li>• <strong>Safe zone:</strong> Content ends at 1520px, stays above Instagram caption overlay</li>
              <li>• <strong>Transitions:</strong> Cross-fade between pages at frame 180</li>
            </ul>
          </div>

          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-3 text-[#0085FF]">Audio & Music</h3>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li>• <strong>Narration:</strong> ElevenLabs TTS (female voice), 1 continuous script (2.5 WPS target)</li>
              <li>• <strong>Timing:</strong> 30s min video. Narration fills 27s, logo outro 3s.</li>
              <li>• <strong>SSML pauses:</strong> 0.5s / 0.8s breaks at transitions</li>
              <li>• <strong>Music:</strong> 4 pre-clipped WAV tracks, deterministic rotation by post ID</li>
            </ul>
          </div>

          <div className="bg-[#0f1420] border border-[#0085FF]/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-3 text-[#0085FF]">Caption & CTA</h3>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li>• <strong>Hook:</strong> First line captures attention ("AI stops guessing and writes to a real person.")</li>
              <li>• <strong>Technique:</strong> Brief explanation of what changed and why</li>
              <li>• <strong>CTA:</strong> "Swipe for the prompt upgrade →" + rotating closer ("Try it tonight.", "Save this one.", etc.)</li>
              <li>• <strong>Hashtags:</strong> #promptengineering #chatgpt #claude #aihacks #aiprompts</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Brand */}
      <section className="px-6 py-24 bg-[#0a0d1a] border-y border-[#0085FF]/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Brand Identity</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0f1420] rounded-lg p-8">
              <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Visual</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#0085FF] rounded"></div>
                  <div>
                    <p className="font-bold text-white">#0085FF</p>
                    <p className="text-sm text-gray-400">Primary Blue</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FF2D78] rounded"></div>
                  <div>
                    <p className="font-bold text-white">#FF2D78</p>
                    <p className="text-sm text-gray-400">Accent Pink</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#080B14] border border-gray-500 rounded"></div>
                  <div>
                    <p className="font-bold text-white">#080B14</p>
                    <p className="text-sm text-gray-400">Deep Navy</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-6">Neon Noir aesthetic: dark, techy, mature but energetic.</p>
            </div>

            <div className="bg-[#0f1420] rounded-lg p-8">
              <h3 className="text-xl font-bold mb-4 text-[#0085FF]">Messaging</h3>
              <div className="space-y-4 text-gray-300">
                <div>
                  <p className="font-bold text-white mb-1">Tagline</p>
                  <p className="text-[#0085FF]">"Better prompts, better results."</p>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">Tone</p>
                  <p>Edgy, confident, no fluff. Teach people what actually works.</p>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">Audience</p>
                  <p>Anyone using AI daily. From students to professionals. No gatekeeping.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="px-6 py-12 text-center text-gray-500 border-t border-[#0085FF]/20">
        <p>@well.prompted on Instagram</p>
        <p className="text-sm mt-2">Fully automated. Human-approved. AI-powered.</p>
      </section>
    </div>
  );
}
