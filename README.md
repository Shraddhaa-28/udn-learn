# OpenShift UDN

Two separate learning tools. They do not share sessions, nav, or progress.

## 1. Classroom (visual sessions)

**https://shraddhaa-28.github.io/udn-learn/classroom.html**

Ten sessions from yesterday. Diagrams you click. Play types fake `oc`. Quizzes. Ask a doubt. You do not write YAML and you do not get a cluster.

## 2. Cluster lab (your test cluster)

**https://shraddhaa-28.github.io/udn-learn/lab.html**

Steps and a doc link. You run `oc` on a throwaway OpenShift with OVN-Kubernetes. Check a box when the step works. Optional labs for Virt Layer 2 and Localnet.

This page does not talk to a cluster.

## Home

**https://shraddhaa-28.github.io/udn-learn/**

Pick classroom or cluster lab.

Locally:

```bash
python3 -m http.server 8765 --bind ::
```

Then open **http://localhost:8765**.

## Classroom sessions

0. Intro & guide
1. Why UDN exists — one shared hallway
2. Island model — overlapping CIDRs, no path
3. Primary vs secondary NIC
4. UDN vs ClusterUserDefinedNetwork
5. Layer 2 / Layer 3 / Localnet
6. Implementation order (and the trap)
7. DNS, registry, NetworkPolicy gotchas
8. Virtual machines and live migration
9. ClusterNetworkConnect
10. TE decision tree
★ You did it

## Cluster labs

00. Confirm OVN + UDN CRDs
01. Default overlay (hallway ping)
02. Birth label, Layer3 UDN, pod last
03. Second island, overlapping CIDR, no ping
04. DNS lie + registry
05. ClusterNetworkConnect ServiceNetwork
06. Layer2 CUDN for VMs (optional)
07. Localnet Secondary (optional)
08. Cleanup

## Docs this is based on

- [OpenShift 4.22 primary / user-defined networks](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks)
- [OKD understanding multiple networks](https://docs.okd.io/latest/networking/multiple_networks/understanding-multiple-networks.html)
- [OpenShift 4.22 Virtualization networking](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/virtualization/networking)
- [ClusterUserDefinedNetwork API](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/network_apis/clusteruserdefinednetwork-k8s-ovn-org-v1)
- [OVN-Kubernetes ClusterNetworkConnect](https://ovn-kubernetes.io/features/user-defined-networks/cluster-network-connect/)
- [OVN-Kubernetes UDN OKEP](https://ovn-kubernetes.io/master/okeps/okep-5193-user-defined-networks/)
