import {
  commitMutation,
  graphql,
} from 'react-relay';
import {ConnectionHandler} from 'relay-runtime';

const mutation = graphql`
  mutation AddTodoMutation($input: CreateTodoInput!) {
    createTodo(input:$input) {
      changedEdge {
        cursor
        node {
          complete
          id
          text
        }
      }
      viewer {
        user {
          id
          completedTodos: todos(
            where: { complete: { eq: true } }
          ) {
            aggregations {
              count
            }
          }
          todos(
            first: 2147483647  # max GraphQLInt
          ) {
            aggregations {
              count
            }
          }
        }
      }
    }
  }
`;

function sharedUpdater(store, user, newEdge) {
  const userProxy = store.get(user.id);
  const conn = ConnectionHandler.getConnection(
    userProxy,
    'TodoList_todos',
  );
  ConnectionHandler.insertEdgeBefore(conn, newEdge);
}

let tempID = 0;

function commit(
  environment,
  text,
  user
) {
  return commitMutation(
    environment,
    {
      mutation,
      variables: {
        input: {
          userId: user.id,
          text,
          clientMutationId: tempID++,
        },
      },

      updater: (store) => {
        const payload = store.getRootField('createTodo');
        const newEdge = payload.getLinkedRecord('changedEdge');
        sharedUpdater(store, user, newEdge);
      },

      optimisticUpdater: (store) => {
        const id = 'client:newTodo:' + tempID++;
        const node = store.create(id, 'Todo');
        node.setValue(text, 'text');
        node.setValue(id, 'id');
        const newEdge = store.create(
          'client:newEdge:' + tempID++,
          'TodoEdge',
        );
        newEdge.setLinkedRecord(node, 'node');
        sharedUpdater(store, user, newEdge);
      },

      optimisticResponse: {
        createTodo: {
          viewer: {
            user: {
              id: user.id,
              todos: {
                aggregations: {
                  count: user.todos.aggregations.count + 1,
                }
              }
            }
          }
        }
      },
    }
  );
}

export default {commit};