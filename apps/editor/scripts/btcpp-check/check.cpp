// Loads a BehaviorTree.CPP XML file with the real library, the way Nav2 and
// any BT.CPP executor would. Nodes the library doesn't ship are registered
// as do-nothing stand-ins with the ports listed in a manifest (built by
// check.py from TreeNodesModel files), so the check covers node names, port
// names and tree structure without needing the real node implementations.
//
//   btcpp_check <tree.xml> <manifest>
//
// Manifest lines: <Action|Condition|Control|Decorator> <ID> [input|output|inout:<port>]...
// Exits 0 when every <BehaviorTree> in the file instantiates.

#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>

#ifdef BTCPP_V3
#include <behaviortree_cpp_v3/bt_factory.h>
using NodeConfig = BT::NodeConfiguration;
#else
#include <behaviortree_cpp/bt_factory.h>
using NodeConfig = BT::NodeConfig;
#endif

namespace
{
struct StandInAction : BT::SyncActionNode
{
  StandInAction(const std::string& name, const NodeConfig& config) : BT::SyncActionNode(name, config) {}
  BT::NodeStatus tick() override { return BT::NodeStatus::SUCCESS; }
};

struct StandInCondition : BT::ConditionNode
{
  StandInCondition(const std::string& name, const NodeConfig& config) : BT::ConditionNode(name, config) {}
  BT::NodeStatus tick() override { return BT::NodeStatus::SUCCESS; }
};

struct StandInControl : BT::ControlNode
{
  StandInControl(const std::string& name, const NodeConfig& config) : BT::ControlNode(name, config) {}
  BT::NodeStatus tick() override { return BT::NodeStatus::SUCCESS; }
};

struct StandInDecorator : BT::DecoratorNode
{
  StandInDecorator(const std::string& name, const NodeConfig& config) : BT::DecoratorNode(name, config) {}
  BT::NodeStatus tick() override { return BT::NodeStatus::SUCCESS; }
};

template <typename T>
BT::NodeBuilder builder()
{
  return [](const std::string& name, const NodeConfig& config) { return std::make_unique<T>(name, config); };
}

// Returns how many stand-ins were registered; builtins keep their real implementation
int registerStandIns(BT::BehaviorTreeFactory& factory, const std::string& manifestPath)
{
  std::ifstream manifest(manifestPath);
  std::string line;
  int registered = 0;
  while (std::getline(manifest, line))
  {
    std::istringstream fields(line);
    std::string kind, id, token;
    if (!(fields >> kind >> id) || factory.manifests().count(id) > 0)
    {
      continue;
    }

    BT::PortsList ports;
    while (fields >> token)
    {
      const auto colon = token.find(':');
      const std::string direction = token.substr(0, colon);
      const std::string name = token.substr(colon + 1);
      if (direction == "output")
        ports.insert(BT::OutputPort(name));
      else if (direction == "inout")
        ports.insert(BT::BidirectionalPort(name));
      else
        ports.insert(BT::InputPort(name));
    }

    BT::TreeNodeManifest node;
    node.registration_ID = id;
    node.ports = ports;
    if (kind == "Action")
    {
      node.type = BT::NodeType::ACTION;
      factory.registerBuilder(node, builder<StandInAction>());
    }
    else if (kind == "Condition")
    {
      node.type = BT::NodeType::CONDITION;
      factory.registerBuilder(node, builder<StandInCondition>());
    }
    else if (kind == "Control")
    {
      node.type = BT::NodeType::CONTROL;
      factory.registerBuilder(node, builder<StandInControl>());
    }
    else if (kind == "Decorator")
    {
      node.type = BT::NodeType::DECORATOR;
      factory.registerBuilder(node, builder<StandInDecorator>());
    }
    else
    {
      continue;
    }
    registered++;
  }
  return registered;
}
}  // namespace

int main(int argc, char** argv)
{
  if (argc != 3)
  {
    std::cerr << "usage: btcpp_check <tree.xml> <manifest>\n";
    return 2;
  }

  BT::BehaviorTreeFactory factory;
  try
  {
    registerStandIns(factory, argv[2]);
    // Validates the whole document: known nodes, child counts, subtree IDs
    factory.registerBehaviorTreeFromFile(argv[1]);
    // Instantiating checks every port name against the node's ports
    for (const auto& id : factory.registeredBehaviorTrees())
    {
      auto tree = factory.createTree(id);
    }
  }
  catch (const std::exception& error)
  {
    std::cout << error.what() << "\n";
    return 1;
  }
  return 0;
}
