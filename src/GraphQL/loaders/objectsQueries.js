import {
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLString,
  GraphQLInt,
  GraphQLObjectType,
} from 'graphql';
import getFieldNames from 'graphql-list-fields';
import Parse from 'parse/node';
import * as defaultGraphQLTypes from './defaultGraphQLTypes';
import rest from '../../rest';

const getObject = async (
  className,
  objectId,
  keys,
  include,
  readPreference,
  includeReadPreference,
  config,
  auth,
  info
) => {
  const options = {};
  if (keys) {
    options.keys = keys;
  }
  if (include) {
    options.include = include;
    if (includeReadPreference) {
      options.includeReadPreference = includeReadPreference;
    }
  }
  if (readPreference) {
    options.readPreference = readPreference;
  }

  const response = await rest.get(
    config,
    auth,
    className,
    objectId,
    options,
    info.clientSDK
  );

  if (!response.results || response.results.length == 0) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
  }

  if (className === '_User') {
    delete response.results[0].sessionToken;

    const user = response.results[0];

    if (auth.user && user.objectId == auth.user.id) {
      // Force the session token
      response.results[0].sessionToken = info.sessionToken;
    }
  }

  return response.results[0];
};

const load = parseGraphQLSchema => {
  parseGraphQLSchema.graphQLObjectsQueries.get = {
    description:
      'The get query can be used to get an object of a certain class by its objectId.',
    args: {
      className: defaultGraphQLTypes.CLASS_NAME_ATT,
      objectId: defaultGraphQLTypes.OBJECT_ID_ATT,
      keys: {
        description: 'The keys of the object that will be returned',
        type: GraphQLString,
      },
      include: {
        description: 'The pointers of the object that will be returned',
        type: GraphQLString,
      },
      readPreference: defaultGraphQLTypes.READ_PREFERENCE_ATT,
      includeReadPreference: defaultGraphQLTypes.INCLUDE_READ_PREFERENCE_ATT,
    },
    type: new GraphQLNonNull(defaultGraphQLTypes.OBJECT),
    async resolve(_source, args, context) {
      try {
        const {
          className,
          objectId,
          keys,
          include,
          readPreference,
          includeReadPreference,
        } = args;
        const { config, auth, info } = context;

        return await getObject(
          className,
          objectId,
          keys,
          include,
          readPreference,
          includeReadPreference,
          config,
          auth,
          info
        );
      } catch (e) {
        parseGraphQLSchema.handleError(e);
      }
    },
  };

  parseGraphQLSchema.graphQLObjectsQueries.find = {
    description:
      'The find query can be used to find objects of a certain class.',
    args: {
      className: {
        description: 'This is the class name of the objects to be found',
        type: new GraphQLNonNull(GraphQLString),
      },
      where: {
        description:
          'These are the conditions that the objects need to match in order to be found',
        type: defaultGraphQLTypes.OBJECT,
      },
      order: {
        description:
          'This is the order in which the objects should be returned',
        type: GraphQLString,
      },
      skip: {
        description:
          'This is the number of objects that must be skipped to return',
        type: GraphQLInt,
      },
      limit: {
        description:
          'This is the limit number of objects that must be returned',
        type: GraphQLInt,
      },
      keys: {
        description: 'The keys of the objects that will be returned',
        type: GraphQLString,
      },
      include: {
        description: 'The pointers of the objects that will be returned',
        type: GraphQLString,
      },
      includeAll: {
        description: 'All pointers will be returned',
        type: GraphQLBoolean,
      },
      readPreference: {
        description: 'The read preference for the main query to be executed',
        type: defaultGraphQLTypes.READ_PREFERENCE,
      },
      includeReadPreference: {
        description:
          'The read preference for the queries to be executed to include fields',
        type: defaultGraphQLTypes.READ_PREFERENCE,
      },
      subqueryReadPreference: {
        description:
          'The read preference for the subqueries that may be required',
        type: defaultGraphQLTypes.READ_PREFERENCE,
      },
    },
    type: new GraphQLNonNull(defaultGraphQLTypes.FIND_RESULT),
    async resolve(_source, args, context, queryInfo) {
      try {
        const {
          className,
          order,
          skip,
          limit,
          keys,
          include,
          includeAll,
          readPreference,
          includeReadPreference,
          subqueryReadPreference,
        } = args;
        let { where } = args;
        const { config, auth, info } = context;
        const selectedFields = getFieldNames(queryInfo);

        if (!where) {
          where = {};
        }

        const options = {};

        if (selectedFields.includes('results')) {
          if (limit || limit === 0) {
            options.limit = limit;
          }
          if (options.limit !== 0) {
            if (order) {
              options.order = order;
            }
            if (skip) {
              options.skip = skip;
            }
            if (config.maxLimit && options.limit > config.maxLimit) {
              // Silently replace the limit on the query with the max configured
              options.limit = config.maxLimit;
            }
            if (keys) {
              options.keys = keys;
            }
            if (includeAll === true) {
              options.includeAll = includeAll;
            }
            if (!options.includeAll && include) {
              options.include = include;
            }
            if (
              (options.includeAll || options.include) &&
              includeReadPreference
            ) {
              options.includeReadPreference = includeReadPreference;
            }
          }
        } else {
          options.limit = 0;
        }

        if (selectedFields.includes('count')) {
          options.count = true;
        }

        if (readPreference) {
          options.readPreference = readPreference;
        }
        if (Object.keys(where).length > 0 && subqueryReadPreference) {
          options.subqueryReadPreference = subqueryReadPreference;
        }

        return await rest.find(
          config,
          auth,
          className,
          where,
          options,
          info.clientSDK
        );
      } catch (e) {
        parseGraphQLSchema.handleError(e);
      }
    },
  };

  const objectsQuery = new GraphQLObjectType({
    name: 'ObjectsQuery',
    description: 'ObjectsQuery is the top level type for objects queries.',
    fields: parseGraphQLSchema.graphQLObjectsQueries,
  });
  parseGraphQLSchema.graphQLTypes.push(objectsQuery);

  parseGraphQLSchema.graphQLQueries.objects = {
    description: 'This is the top level for objects queries.',
    type: objectsQuery,
    resolve: () => new Object(),
  };
};

export { getObject, load };