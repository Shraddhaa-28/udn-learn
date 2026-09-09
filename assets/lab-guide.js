/* Guided UDN labs. Run on YOUR test cluster. Sparse on purpose. */
window.UDN_LABS = [
  {
    id: "prep",
    n: "00",
    title: "Test cluster",
    kicker: "Before you start",
    why: "Everything below is live. Use a throwaway OpenShift 4.19+ cluster with OVN-Kubernetes. Not production. Not the classroom.",
    doc: { label: "OCP 4.22 — Primary networks", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Log in and confirm OVN",
        do: "You need cluster-admin (or enough to create namespaces, UDNs, and CUDNs).",
        cmd: "oc whoami && oc get network.operator cluster -o jsonpath='{.spec.defaultNetwork.type}{\"\\n\"}'",
        expect: "OVNKubernetes. If you see OpenShiftSDN, stop. UDN is OVN-Kubernetes only.",
      },
      {
        title: "Confirm UDN CRDs exist",
        cmd: "oc get crd userdefinednetworks.k8s.ovn.org clusteruserdefinednetworks.k8s.ovn.org",
        expect: "Both CRDs listed. If not, this cluster is too old or UDN is not enabled.",
      },
      {
        title: "Image for these labs",
        do: "YAML below uses registry.redhat.io/rhel9/support-tools (ping + curl). If your cluster cannot pull it, change the image before you apply.",
      },
    ],
  },
  {
    id: "hallway",
    n: "01",
    title: "The hallway",
    kicker: "Lab 01",
    why: "By default every pod shares one overlay. Isolation is NetworkPolicy on that overlay — not a second network.",
    doc: { label: "About user-defined networks", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Two namespaces, no UDN",
        do: "These get the cluster default network.",
        yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-a
---
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-b`,
        expect: "namespace/udn-lab-a created (and b).",
      },
      {
        title: "A pod in each",
        yaml: `apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: udn-lab-a
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]
---
apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: udn-lab-b
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]`,
        expect: "Both Running. IPs will look like 10.128.x / 10.129.x (default overlay). Note the IP of api.",
      },
      {
        title: "Ping across tenants",
        cmd: "A=$(oc get pod api -n udn-lab-b -o jsonpath='{.status.podIP}')\noc exec -n udn-lab-a web -- ping -c1 \"$A\"",
        expect: "Ping succeeds. Same hallway. That is why UDN exists.",
      },
    ],
  },
  {
    id: "island",
    n: "02",
    title: "Make an island",
    kicker: "Lab 02",
    why: "Order: namespace with the birth label → UDN CR → pods. The label cannot be added later. The CR cannot be patched. OVN creates the NAD — you do not.",
    doc: { label: "Creating a UserDefinedNetwork CR", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Namespace with the primary-UDN label at create",
        do: "k8s.ovn.org/primary-user-defined-network can only be set when the namespace is born.",
        yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-shop
  labels:
    k8s.ovn.org/primary-user-defined-network: ""`,
        expect: "namespace/udn-lab-shop created. oc label on an existing ns with this key will fail — try it on udn-lab-a if you want the error.",
      },
      {
        title: "Layer 3 primary UDN",
        do: "cidr is the whole island. hostSubnet 24 means each node gets a /24 from that /16.",
        yaml: `# WHAT: primary UDN for ns udn-lab-shop
# WHY: eth0 for every pod in this namespace. Layer3 = pods (per-node subnet + router)
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-net
  namespace: udn-lab-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24`,
        expect: "userdefinednetwork.k8s.ovn.org/shop-net created. Wait until oc get udn -n udn-lab-shop shows NetworkReady.",
      },
      {
        title: "OVN minted a NAD",
        cmd: "oc get udn,nad -n udn-lab-shop",
        expect: "udn/shop-net and nad/shop-net. You did not apply a NAD.",
      },
      {
        title: "Pod last",
        yaml: `apiVersion: v1
kind: Pod
metadata:
  name: shop-web
  namespace: udn-lab-shop
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]`,
        expect: "oc get pod -n udn-lab-shop -o wide — IP starts with 10.100. not 10.128. That is how you know it worked.",
      },
    ],
  },
  {
    id: "isolate",
    n: "03",
    title: "Two islands",
    kicker: "Lab 03",
    why: "Same CIDR on two primary UDNs is allowed. There is still no path. NetworkPolicy cannot invent one.",
    doc: { label: "Limitations of a user-defined network", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Second tenant, same subnet numbers",
        yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-bank
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
---
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: bank-net
  namespace: udn-lab-bank
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
apiVersion: v1
kind: Pod
metadata:
  name: bank-api
  namespace: udn-lab-bank
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]`,
        expect: "bank-api Running on 10.100.x. Overlapping with shop is fine.",
      },
      {
        title: "Ping shop → bank UDN IP",
        cmd: "B=$(oc get pod bank-api -n udn-lab-bank -o jsonpath='{.status.podIP}')\noc exec -n udn-lab-shop shop-web -- ping -c1 \"$B\"",
        expect: "Network is unreachable (or 100% loss). Same numbers, different networks.",
      },
    ],
  },
  {
    id: "gotchas",
    n: "04",
    title: "DNS and registry",
    kicker: "Lab 04",
    why: "Pod DNS still returns the default-network IP. The in-cluster image registry is often unreachable from a primary UDN. Do not promise either on a call.",
    doc: { label: "UDN limitations", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Addresses on shop-web",
        cmd: "oc exec -n udn-lab-shop shop-web -- ip -br addr",
        expect: "eth0 is 10.100.x (UDN). There is still a default-network address for kubelet/DNS.",
      },
      {
        title: "nslookup the pod",
        cmd: "oc exec -n udn-lab-shop shop-web -- nslookup shop-web.udn-lab-shop.pod.cluster.local",
        expect: "The address is the default-network IP, not 10.100.x. Service DNS still works.",
      },
      {
        title: "Hit the image registry",
        cmd: "oc exec -n udn-lab-shop shop-web -- curl -sI --max-time 5 image-registry.openshift-image-registry.svc:5000 || true",
        expect: "Usually fails to connect. S2I / oc new-app in this namespace will fail the same way.",
      },
    ],
  },
  {
    id: "cnc",
    n: "05",
    title: "Connect an API, not the islands",
    kicker: "Lab 05",
    why: "ClusterNetworkConnect is admin-only. ServiceNetwork = ClusterIP across selected primaries. Pod IPs stay isolated. Start here, not PodNetwork.",
    doc: { label: "OVN-Kubernetes ClusterNetworkConnect", url: "https://ovn-kubernetes.io/features/user-defined-networks/cluster-network-connect/" },
    steps: [
      {
        title: "Label both namespaces and expose bank-api",
        cmd: "oc label ns udn-lab-shop connect=shop-bank --overwrite\noc label ns udn-lab-bank connect=shop-bank --overwrite\noc expose pod/bank-api -n udn-lab-bank --port=8080 --target-port=8080 || oc create svc clusterip bank-api -n udn-lab-bank --tcp=8080:8080",
        expect: "Both ns have connect=shop-bank. A ClusterIP exists for bank-api (port can be dummy if the app does not listen — you still learn the path).",
      },
      {
        title: "CNC with ServiceNetwork only",
        do: "connectSubnets is OVN's transit range, not a tenant CIDR. Do not overlap 10.100.0.0/16.",
        yaml: `# WHAT: peer the two primary UDNs for ClusterIP only
# WHY: shop can call bank's Service. Pod IPs stay isolated.
apiVersion: k8s.ovn.org/v1
kind: ClusterNetworkConnect
metadata:
  name: shop-to-bank
spec:
  connectivity:
    - ServiceNetwork
  connectSubnets:
    - cidr: 100.88.0.0/16
      networkPrefix: 24
  networkSelectors:
    - networkSelectionType: PrimaryUserDefinedNetworks
      primaryUserDefinedNetworks:
        namespaceSelector:
          matchLabels:
            connect: shop-bank`,
        expect: "If the CRD is missing, this cluster has no CNC — skip and read the doc. If it applies: curl to bank-api.udn-lab-bank.svc from shop-web. Ping of the bank pod IP still fails.",
      },
    ],
  },
  {
    id: "l2",
    n: "06",
    title: "Layer 2 for VMs",
    kicker: "Lab 06 · optional",
    why: "Skip if you do not have OpenShift Virtualization. Virt wants Layer2 + Persistent IPAM so live migrate keeps the IP. Localnet cannot be primary. Layer3 is the wrong topology for that VM.",
    doc: { label: "Virt — connecting a VM to a primary UDN", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/virtualization/networking" },
    steps: [
      {
        title: "Namespace + Layer2 CUDN",
        do: "CUDN is admin-only. Selector must not be empty and must not match openshift-*.",
        yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-virt
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
    tenant: virt
---
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vm-switch
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets:
        - 192.168.100.0/24
      ipam:
        lifecycle: Persistent`,
        expect: "CUDN NetworkReady. Create a VM in udn-lab-virt if you want to live-migrate and watch the IP stay.",
      },
    ],
  },
  {
    id: "localnet",
    n: "07",
    title: "Localnet (VLAN)",
    kicker: "Lab 07 · optional",
    why: "Skip unless nodes already have an OVS bridge mapping. Localnet is Secondary only, on a CUDN. physicalNetworkName must match the mapping name.",
    doc: { label: "Creating a CUDN for Localnet", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "See the mapping name first",
        cmd: "oc get nodenetworkstate -o yaml | grep -A2 -i localnet || oc get nncp",
        expect: "A physicalNetworkName (example: localnet1). If there is none, do not apply the next CR.",
      },
      {
        title: "Secondary Localnet CUDN",
        do: "Change physicalNetworkName to match YOUR mapping. Role Primary will be rejected — that is the lesson.",
        yaml: `apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vlan20
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Localnet
    localnet:
      role: Secondary
      physicalNetworkName: localnet1
      vlan:
        mode: Access
        access:
          id: 20`,
        expect: "NetworkReady only if the mapping exists and VLAN 20 is actually on the wire.",
      },
    ],
  },
  {
    id: "cleanup",
    n: "08",
    title: "Cleanup",
    kicker: "Lab 08",
    why: "Delete what you created so the next person (or you tomorrow) starts clean.",
    doc: { label: "Primary networks", url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks" },
    steps: [
      {
        title: "Remove lab objects",
        cmd: "oc delete cnc shop-to-bank --ignore-not-found\noc delete cudn vm-switch vlan20 --ignore-not-found\noc delete ns udn-lab-a udn-lab-b udn-lab-shop udn-lab-bank udn-lab-virt --wait=false",
        expect: "Namespaces Terminating. Primary UDNs go with the namespace.",
      },
    ],
  },
];
