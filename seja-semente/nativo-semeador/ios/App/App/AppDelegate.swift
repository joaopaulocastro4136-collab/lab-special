import UIKit
import Capacitor
import PushKit
import CallKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?


    // ─── Chamada estilo LIGAÇÃO (VoIP + CallKit): o push acorda o app e o
    // iPhone mostra a tela de ligação de verdade, tocando até atender ───
    var registroVoip: PKPushRegistry?
    var provedorChamada: CXProvider?
    var tokenVoip: String = ""
    var chamadasAbertas: [UUID: String] = [:]

    func ligarChamadaNativa() {
        let cfg = CXProviderConfiguration()
        cfg.supportsVideo = false
        cfg.maximumCallGroups = 1
        cfg.maximumCallsPerCallGroup = 1
        cfg.supportedHandleTypes = [.generic]
        let prov = CXProvider(configuration: cfg)
        prov.setDelegate(self, queue: nil)
        provedorChamada = prov
        let reg = PKPushRegistry(queue: .main)
        reg.delegate = self
        reg.desiredPushTypes = [.voIP]
        registroVoip = reg
    }

    // Entrega o token VoIP para o app (JS), que grava no banco.
    // O app demora alguns segundos para carregar (busca o código da
    // hospedagem), então insiste várias vezes — entregas repetidas são
    // inofensivas.
    func entregarTokenVoip() {
        guard !tokenVoip.isEmpty else { return }
        for atraso in [0.5, 3.0, 7.0, 12.0, 20.0, 35.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + atraso) { [weak self] in
                guard let eu = self, !eu.tokenVoip.isEmpty else { return }
                eu.rodarJS("window.__tokenVoip='" + eu.tokenVoip + "';window.dispatchEvent(new CustomEvent('token-voip',{detail:'" + eu.tokenVoip + "'}))")
            }
        }
    }

    func rodarJS(_ codigo: String) {
        DispatchQueue.main.async {
            var raiz = UIApplication.shared.windows.first?.rootViewController
            if raiz == nil {
                raiz = UIApplication.shared.connectedScenes
                    .compactMap { ($0 as? UIWindowScene)?.windows.first }
                    .first?.rootViewController
            }
            (raiz as? CAPBridgeViewController)?.bridge?.webView?.evaluateJavaScript(codigo, completionHandler: nil)
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        ligarChamadaNativa()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // ─── Push (chamadas): repassa o token/erro da Apple para o plugin ───
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// ─── VoIP: recebe o token e as chamadas, mesmo com o app fechado ───
extension AppDelegate: PKPushRegistryDelegate {
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        tokenVoip = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        entregarTokenVoip()
    }

    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        let dados = payload.dictionaryPayload
        let quem = (dados["quem"] as? String) ?? "Seja Semente"
        let id = (dados["chamadaId"] as? String) ?? ""
        let uuid = UUID()
        chamadasAbertas[uuid] = id
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: quem)
        update.localizedCallerName = quem
        update.hasVideo = false
        provedorChamada?.reportNewIncomingCall(with: uuid, update: update) { _ in completion() }
        // Ninguém atendeu em 50s: para de tocar sozinho (a chamada já passou)
        DispatchQueue.main.asyncAfter(deadline: .now() + 50) { [weak self] in
            if self?.chamadasAbertas[uuid] != nil {
                self?.chamadasAbertas[uuid] = nil
                self?.provedorChamada?.reportCall(with: uuid, endedAt: nil, reason: .unanswered)
            }
        }
    }
}

// ─── O que acontece quando a pessoa atende ou recusa na tela de ligação ───
extension AppDelegate: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) { chamadasAbertas.removeAll() }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        let id = chamadasAbertas[action.callUUID] ?? ""
        chamadasAbertas[action.callUUID] = nil
        if !id.isEmpty { rodarJS("window.__atenderChamada && window.__atenderChamada('" + id + "')") }
        action.fulfill()
        // Não é ligação de áudio de verdade: fecha a tela logo após atender
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            self?.provedorChamada?.reportCall(with: action.callUUID, endedAt: nil, reason: .remoteEnded)
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        chamadasAbertas[action.callUUID] = nil
        action.fulfill()
    }
}
